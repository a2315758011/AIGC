#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const skillRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillRoot, "../..");
const lockPath = path.join(skillRoot, "SOURCE_LOCK.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBlobSha(bytes) {
  const header = Buffer.from("blob " + bytes.length + "\0", "utf8");
  return crypto.createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

function walkFiles(root, current = root) {
  const result = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(root, full));
    else if (entry.isFile()) result.push(path.relative(root, full).split(path.sep).join("/"));
    else fail("unsupported file type in staging: " + full);
  }
  return result.sort();
}

function runNode(root, scriptPath, fixturePath) {
  console.log("RUN " + scriptPath + " " + fixturePath);
  execFileSync(process.execPath, [scriptPath, fixturePath], {
    cwd: root,
    stdio: "inherit"
  });
}

function main() {
  if (lock.package !== "storyboard-director-cn" || lock.version !== "1.3.7" ||
      lock.source_version !== "V2.10.6" || !Array.isArray(lock.files)) {
    fail("SOURCE_LOCK package/version/source_version is not the expected 1.3.7 release");
  }

  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  if (outputIndex >= 0 && (!outputPath || outputPath.startsWith("--"))) {
    fail("--output requires a destination path");
  }
  const finalZip = outputPath ? path.resolve(outputPath) : null;
  if (finalZip && fs.existsSync(finalZip)) fail("refusing to overwrite existing package output: " + finalZip);

  const sourceEntries = [];
  for (const entry of lock.files) {
    const source = path.join(skillRoot, entry.package_path);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      fail("SOURCE_LOCK file missing: " + entry.package_path);
    }
    const bytes = fs.readFileSync(source);
    const actualBlob = gitBlobSha(bytes);
    if (actualBlob !== entry.git_blob_sha) {
      fail("SOURCE_LOCK Git blob mismatch for " + entry.package_path +
        "; expected " + entry.git_blob_sha + "; actual " + actualBlob);
    }
    if (entry.characters !== undefined && bytes.toString("utf8").length !== entry.characters) {
      fail("SOURCE_LOCK character count mismatch for " + entry.package_path);
    }
    sourceEntries.push({ package_path: entry.package_path, source, bytes });
  }
  console.log("PASS source package pins: " + sourceEntries.length);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "storyboard-skill-1.3.7-"));
  const packageRoot = path.join(tempRoot, "storyboard-director-cn");
  const extractRoot = path.join(tempRoot, "extracted");
  const tempZip = path.join(tempRoot, "storyboard-director-cn-1.3.7.zip");
  let outputCopied = false;

  try {
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(extractRoot, { recursive: true });

    for (const entry of sourceEntries) {
      const target = path.join(packageRoot, entry.package_path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.bytes);
    }

    const lockBytes = fs.readFileSync(lockPath);
    fs.writeFileSync(path.join(packageRoot, "SOURCE_LOCK.json"), lockBytes);

    const manifestFiles = [
      ...sourceEntries.map((entry) => ({
        path: entry.package_path,
        size_bytes: entry.bytes.length,
        sha256: sha256(entry.bytes)
      })),
      {
        path: "SOURCE_LOCK.json",
        size_bytes: lockBytes.length,
        sha256: sha256(lockBytes)
      }
    ].sort((a, b) => a.path.localeCompare(b.path));

    const manifest = {
      package: "storyboard-director-cn",
      version: lock.version,
      source_version: lock.source_version,
      generated_at: new Date().toISOString(),
      files: manifestFiles
    };
    fs.writeFileSync(
      path.join(packageRoot, "artifact-manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n"
    );

    execFileSync("zip", ["-qr", tempZip, "storyboard-director-cn"], { cwd: tempRoot });
    execFileSync("unzip", ["-q", tempZip, "-d", extractRoot]);

    const extractedRoot = path.join(extractRoot, "storyboard-director-cn");
    const actualFiles = walkFiles(extractedRoot);
    const expectedFiles = [...manifestFiles.map((item) => item.path), "artifact-manifest.json"].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      fail("extracted ZIP file set differs from artifact manifest");
    }

    const extractedManifest = JSON.parse(fs.readFileSync(
      path.join(extractedRoot, "artifact-manifest.json"), "utf8"
    ));
    if (extractedManifest.package !== lock.package ||
        extractedManifest.version !== lock.version ||
        extractedManifest.source_version !== lock.source_version) {
      fail("extracted artifact manifest metadata mismatch");
    }

    for (const item of manifestFiles) {
      const bytes = fs.readFileSync(path.join(extractedRoot, item.path));
      if (bytes.length !== item.size_bytes || sha256(bytes) !== item.sha256) {
        fail("extracted ZIP SHA-256/size mismatch: " + item.path);
      }
    }
    console.log("PASS fresh ZIP staging, extracted file set and SHA-256 manifest: " + manifestFiles.length);

    runNode(extractedRoot, "scripts/分镜SCG校验器-V1.js", "tests/分镜SCG回归样例-V1.json");
    runNode(extractedRoot, "scripts/validate-facial-performance-continuity.cjs", "tests/面部表演连续性回归样例-V1.json");
    runNode(extractedRoot, "scripts/分镜事件时长校验器-V1.js", "tests/分镜事件时长回归样例-V1.json");

    if (finalZip) {
      fs.mkdirSync(path.dirname(finalZip), { recursive: true });
      fs.copyFileSync(tempZip, finalZip, fs.constants.COPYFILE_EXCL);
      outputCopied = true;
      console.log("PASS package ZIP exported: " + finalZip);
    }
    console.log("PASS offline package build, extract, integrity and regression");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (fs.existsSync(tempRoot)) fail("temporary staging cleanup failed: " + tempRoot);
    console.log("PASS temporary staging cleanup");
  }

  if (finalZip && (!outputCopied || !fs.existsSync(finalZip))) {
    fail("requested ZIP output was not created");
  }
}

try {
  main();
} catch (error) {
  console.error("FAIL " + (error && error.stack ? error.stack : String(error)));
  process.exitCode = 1;
}
