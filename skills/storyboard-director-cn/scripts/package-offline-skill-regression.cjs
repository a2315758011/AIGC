#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const skillRoot = path.resolve(__dirname, "..");
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
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(root, fullPath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).split(path.sep).join("/"));
    } else {
      fail("unsupported filesystem entry in extracted package: " + fullPath);
    }
  }
  return files.sort();
}

function runNode(root, scriptPath, fixturePath) {
  console.log("RUN node " + scriptPath + " " + fixturePath);
  execFileSync(process.execPath, [scriptPath, fixturePath], {
    cwd: root,
    stdio: "inherit"
  });
}

function main() {
  if (lock.package !== "storyboard-director-cn" ||
      lock.version !== "1.3.7" ||
      lock.source_version !== "V2.10.6" ||
      !Array.isArray(lock.files) ||
      lock.files.length === 0) {
    fail("SOURCE_LOCK must pin storyboard-director-cn 1.3.7 / V2.10.6");
  }

  const outputIndex = process.argv.indexOf("--output");
  const outputArg = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  if (outputIndex >= 0 && (!outputArg || outputArg.startsWith("--"))) {
    fail("--output requires a destination path");
  }
  const finalZip = outputArg ? path.resolve(outputArg) : null;
  if (finalZip && fs.existsSync(finalZip)) {
    fail("refusing to overwrite existing package output: " + finalZip);
  }

  const sourceEntries = [];
  const seenPaths = new Set();
  for (const entry of lock.files) {
    if (!entry || typeof entry.package_path !== "string" ||
        entry.package_path.startsWith("/") ||
        entry.package_path.split("/").includes("..") ||
        seenPaths.has(entry.package_path)) {
      fail("invalid or duplicate SOURCE_LOCK package_path");
    }
    seenPaths.add(entry.package_path);

    const sourcePath = path.resolve(skillRoot, entry.package_path);
    if (!sourcePath.startsWith(skillRoot + path.sep) ||
        !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      fail("SOURCE_LOCK package file missing or outside package root: " + entry.package_path);
    }

    const bytes = fs.readFileSync(sourcePath);
    const actualBlob = gitBlobSha(bytes);
    if (actualBlob !== entry.git_blob_sha) {
      fail("SOURCE_LOCK Git blob mismatch for " + entry.package_path +
        "; expected " + entry.git_blob_sha + "; actual " + actualBlob);
    }
    if (entry.characters !== undefined &&
        bytes.toString("utf8").length !== entry.characters) {
      fail("SOURCE_LOCK character-count mismatch for " + entry.package_path);
    }
    sourceEntries.push({ package_path: entry.package_path, bytes });
  }
  console.log("PASS source package pins: " + sourceEntries.length);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "storyboard-skill-1.3.7-"));
  const stagingRoot = path.join(tempRoot, "storyboard-director-cn");
  const extractRoot = path.join(tempRoot, "extracted");
  const tempZip = path.join(tempRoot, "storyboard-director-cn-1.3.7.zip");
  let outputCopied = false;

  try {
    fs.mkdirSync(stagingRoot, { recursive: true });
    fs.mkdirSync(extractRoot, { recursive: true });

    for (const entry of sourceEntries) {
      const destination = path.join(stagingRoot, entry.package_path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, entry.bytes);
    }

    const lockBytes = fs.readFileSync(lockPath);
    fs.writeFileSync(path.join(stagingRoot, "SOURCE_LOCK.json"), lockBytes);

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
      package: lock.package,
      version: lock.version,
      source_version: lock.source_version,
      generated_at: lock.date,
      files: manifestFiles
    };
    fs.writeFileSync(
      path.join(stagingRoot, "artifact-manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n"
    );

    execFileSync("zip", ["-qr", tempZip, "storyboard-director-cn"], {
      cwd: tempRoot,
      stdio: "inherit"
    });
    execFileSync("unzip", ["-q", tempZip, "-d", extractRoot], {
      stdio: "inherit"
    });

    const extractedRoot = path.join(extractRoot, "storyboard-director-cn");
    const actualFiles = walkFiles(extractedRoot);
    const expectedFiles = [
      ...manifestFiles.map((entry) => entry.path),
      "artifact-manifest.json"
    ].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      fail("extracted ZIP file set differs from the manifest");
    }

    const extractedManifest = JSON.parse(fs.readFileSync(
      path.join(extractedRoot, "artifact-manifest.json"), "utf8"
    ));
    if (extractedManifest.package !== lock.package ||
        extractedManifest.version !== lock.version ||
        extractedManifest.source_version !== lock.source_version) {
      fail("extracted artifact-manifest metadata mismatch");
    }

    for (const entry of manifestFiles) {
      const bytes = fs.readFileSync(path.join(extractedRoot, entry.path));
      if (bytes.length !== entry.size_bytes || sha256(bytes) !== entry.sha256) {
        fail("extracted ZIP SHA-256/size mismatch: " + entry.path);
      }
    }
    console.log("PASS extracted ZIP file set and SHA-256 manifest: " + manifestFiles.length);

    runNode(extractedRoot, "scripts/分镜SCG校验器-V1.js",
      "tests/分镜SCG回归样例-V1.json");
    runNode(extractedRoot, "scripts/validate-facial-performance-continuity.cjs",
      "tests/面部表演连续性回归样例-V1.json");
    runNode(extractedRoot, "scripts/分镜事件时长校验器-V1.js",
      "tests/分镜事件时长回归样例-V1.json");

    if (finalZip) {
      fs.mkdirSync(path.dirname(finalZip), { recursive: true });
      fs.copyFileSync(tempZip, finalZip, fs.constants.COPYFILE_EXCL);
      outputCopied = true;
      console.log("PASS exported verified ZIP: " + finalZip);
    }
    console.log("PASS offline Skill build, extraction, integrity and regression");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (fs.existsSync(tempRoot)) {
      fail("temporary staging cleanup failed: " + tempRoot);
    }
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
