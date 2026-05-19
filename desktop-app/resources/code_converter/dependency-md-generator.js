#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".java",
]);

const JS_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
const PY_EXTENSIONS = [".py"];
const JAVA_EXTENSIONS = [".java"];

const IGNORED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  "out",
]);

function usage() {
  console.error("Usage: node dependency-md-generator.js <source-root> <destination-root>");
}

function normalizePath(filePath) {
  return path.resolve(filePath);
}

function toMarkdownPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function stripComments(content, ext) {
  if (ext === ".py") {
    return content
      .replace(/'''[\s\S]*?'''/g, "")
      .replace(/"""[\s\S]*?"""/g, "")
      .replace(/#.*$/gm, "");
  }

  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function walkSourceFiles(root) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
        continue;
      }

      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(path.join(dir, entry.name));
      }
    }
  }

  walk(root);
  return files;
}

function buildIndexes(sourceRoot, files) {
  const byPathNoExt = new Map();
  const javaByQualifiedName = new Map();
  const javaBySimpleName = new Map();
  const pythonModules = new Map();

  for (const file of files) {
    const ext = path.extname(file);
    byPathNoExt.set(file.slice(0, -ext.length), file);

    if (ext === ".py") {
      const relNoExt = path.relative(sourceRoot, file).slice(0, -ext.length);
      const moduleName = relNoExt
        .split(path.sep)
        .filter((part) => part !== "__init__")
        .join(".");
      if (moduleName) {
        pythonModules.set(moduleName, file);
      }
    }

    if (ext === ".java") {
      const content = fs.readFileSync(file, "utf8");
      const packageName = content.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] || "";
      const className = content.match(/\b(?:class|interface|enum|record)\s+([A-Z]\w*)\b/)?.[1];
      if (className) {
        const qualifiedName = packageName ? `${packageName}.${className}` : className;
        javaByQualifiedName.set(qualifiedName, file);
        if (!javaBySimpleName.has(className)) {
          javaBySimpleName.set(className, []);
        }
        javaBySimpleName.get(className).push({ file, packageName, qualifiedName });
      }
    }
  }

  return { byPathNoExt, javaByQualifiedName, javaBySimpleName, pythonModules };
}

function resolveFileCandidates(basePath, extensions) {
  const candidates = [];

  if (path.extname(basePath)) {
    candidates.push(basePath);
  } else {
    for (const ext of extensions) {
      candidates.push(`${basePath}${ext}`);
    }

    for (const ext of extensions) {
      candidates.push(path.join(basePath, `index${ext}`));
    }
  }

  return candidates;
}

function firstExistingFile(candidates, sourceRoot) {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (isInside(sourceRoot, resolved) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }

  return null;
}

function isInside(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveJsDependency(importPath, file, sourceRoot) {
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null;
  }

  const basePath = importPath.startsWith("/")
    ? path.join(sourceRoot, importPath)
    : path.resolve(path.dirname(file), importPath);

  return firstExistingFile(resolveFileCandidates(basePath, JS_EXTENSIONS), sourceRoot);
}

function findJsDependencies(content, file, sourceRoot) {
  const dependencies = new Set();
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]*\s+from\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const dependency = resolveJsDependency(match[1], file, sourceRoot);
      if (dependency) {
        dependencies.add(dependency);
      }
    }
  }

  return dependencies;
}

function resolvePythonModule(moduleName, indexes) {
  if (!moduleName) {
    return null;
  }

  return indexes.pythonModules.get(moduleName) || null;
}

function resolvePythonRelativeModule(dots, moduleName, file, sourceRoot) {
  let dir = path.dirname(file);
  for (let i = 1; i < dots.length; i += 1) {
    dir = path.dirname(dir);
  }

  const parts = moduleName ? moduleName.split(".") : [];
  const basePath = path.join(dir, ...parts);
  return firstExistingFile(
    [
      ...resolveFileCandidates(basePath, PY_EXTENSIONS),
      path.join(basePath, "__init__.py"),
    ],
    sourceRoot,
  );
}

function findPythonDependencies(content, file, sourceRoot, indexes) {
  const dependencies = new Set();

  for (const match of content.matchAll(/^\s*import\s+(.+)$/gm)) {
    const imports = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0]);
    for (const importName of imports) {
      const dependency = resolvePythonModule(importName, indexes);
      if (dependency) {
        dependencies.add(dependency);
      }
    }
  }

  for (const match of content.matchAll(/^\s*from\s+([.\w]+)\s+import\s+(.+)$/gm)) {
    const moduleRef = match[1];
    const importedNames = match[2]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0])
      .filter((part) => part && part !== "*");

    let dependency = null;
    if (moduleRef.startsWith(".")) {
      const dots = moduleRef.match(/^\.+/)?.[0] || "";
      const moduleName = moduleRef.slice(dots.length);
      dependency = resolvePythonRelativeModule(dots, moduleName, file, sourceRoot);
    } else {
      dependency = resolvePythonModule(moduleRef, indexes);
    }

    if (dependency) {
      dependencies.add(dependency);
    }

    for (const importedName of importedNames) {
      const nestedModule = moduleRef.startsWith(".")
        ? null
        : resolvePythonModule(`${moduleRef}.${importedName}`, indexes);
      if (nestedModule) {
        dependencies.add(nestedModule);
      }
    }
  }

  return dependencies;
}

function findJavaDependencies(content, file, indexes) {
  const dependencies = new Set();
  const packageName = content.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] || "";

  for (const match of content.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;/gm)) {
    const importName = match[1];
    const dependency =
      indexes.javaByQualifiedName.get(importName) ||
      indexes.javaByQualifiedName.get(importName.split(".").slice(0, -1).join("."));

    if (dependency) {
      dependencies.add(dependency);
    }
  }

  for (const [simpleName, matches] of indexes.javaBySimpleName.entries()) {
    if (!new RegExp(`\\b${simpleName}\\b`).test(content)) {
      continue;
    }

    for (const candidate of matches) {
      if (candidate.file !== file && candidate.packageName === packageName) {
        dependencies.add(candidate.file);
      }
    }
  }

  return dependencies;
}

function findDependencies(file, sourceRoot, indexes) {
  const ext = path.extname(file);
  const rawContent = fs.readFileSync(file, "utf8");
  const content = stripComments(rawContent, ext);

  if (JS_EXTENSIONS.includes(ext)) {
    return findJsDependencies(content, file, sourceRoot);
  }

  if (PY_EXTENSIONS.includes(ext)) {
    return findPythonDependencies(content, file, sourceRoot, indexes);
  }

  if (JAVA_EXTENSIONS.includes(ext)) {
    return findJavaDependencies(content, file, indexes);
  }

  return new Set();
}

function markdownLink(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile) || path.basename(toFile);
  const href = encodeURI(toMarkdownPath(rel));
  return `[${toMarkdownPath(toFile)}](${href})`;
}

function writeMarkdown(sourceRoot, destinationRoot, sourceFile, dependencies) {
  const relativeSource = path.relative(sourceRoot, sourceFile);
  const parsed = path.parse(relativeSource);
  const outputDir = path.join(destinationRoot, parsed.dir);
  const outputFile = path.join(outputDir, `${parsed.base}.md`);

  fs.mkdirSync(outputDir, { recursive: true });

  const lines = [
    `# ${toMarkdownPath(relativeSource)}`,
    "",
    `Source: ${markdownLink(outputFile, sourceFile)}`,
    "",
    "## Dependencies",
    "",
  ];

  const sortedDependencies = [...dependencies].sort((a, b) => a.localeCompare(b));
  if (sortedDependencies.length === 0) {
    lines.push("No local code dependencies found.");
  } else {
    for (const dependency of sortedDependencies) {
      const relativeDependency = toMarkdownPath(path.relative(sourceRoot, dependency));
      lines.push(`- ${markdownLink(outputFile, dependency)} (${relativeDependency})`);
    }
  }

  lines.push("");
  fs.writeFileSync(outputFile, lines.join("\n"), "utf8");
}

function main() {
  const [, , sourceArg, destinationArg] = process.argv;
  if (!sourceArg || !destinationArg) {
    usage();
    process.exit(1);
  }

  const sourceRoot = normalizePath(sourceArg);
  const destinationRoot = normalizePath(destinationArg);

  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    console.error(`Source root is not a directory: ${sourceRoot}`);
    process.exit(1);
  }

  fs.mkdirSync(destinationRoot, { recursive: true });

  const files = walkSourceFiles(sourceRoot);
  const indexes = buildIndexes(sourceRoot, files);

  for (const file of files) {
    const dependencies = findDependencies(file, sourceRoot, indexes);
    dependencies.delete(file);
    writeMarkdown(sourceRoot, destinationRoot, file, dependencies);
  }

  console.log(`Created ${files.length} markdown file(s) in ${destinationRoot}`);
}

main();
