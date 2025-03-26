const fs = require("fs");
const path = require("path");
const ignore = require("ignore");
const tiktoken = require("@dqbd/tiktoken");

// Configuration
const config = {
  // Choose which model's tokenizer to use - cl100k_base is used by Claude
  encodingName: "cl100k_base",
  // File extensions to analyze
  extensions: [
    // JavaScript/TypeScript
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    // Web
    ".css",
    ".scss",
    ".html",
    ".erb",
    // Ruby/Rails
    ".rb",
    ".rake",
    ".yml",
    ".yaml",
  ],
  // Max file size in bytes to analyze (10MB)
  maxFileSize: 10 * 1024 * 1024,
  // Should we output detailed stats per file?
  verbose: true,
  // Should we respect .gitignore?
  respectGitignore: true,
  // Skip hidden files/folders
  skipHidden: true,
  // Framework type: 'js' or 'rails' or 'both'
  frameworkType: "both",
};

// Main function to analyze codebase
async function analyzeCodebase(rootDir) {
  console.log(`\nAnalyzing codebase in ${rootDir}...`);

  // Load .gitignore if enabled
  let ignoreRules = null;
  if (config.respectGitignore) {
    try {
      const gitignorePath = path.join(rootDir, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
        ignoreRules = ignore().add(gitignoreContent);
        console.log("Loaded .gitignore rules");
      }
    } catch (error) {
      console.warn("Error loading .gitignore:", error.message);
    }
  }

  // Initialize tokenizer
  const encoder = tiktoken.get_encoding(config.encodingName);

  // Stats to collect
  const stats = {
    totalFiles: 0,
    totalTokens: 0,
    totalBytes: 0,
    byExtension: {},
    largestFiles: [],
    avgTokensPerFile: 0,
  };

  // Walk directory recursively
  function walkDir(dir, relativePath = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      // Skip if it's a hidden file or directory (starts with a dot)
      if (entry.name.startsWith(".")) {
        continue;
      }

      // Skip if ignored by .gitignore
      if (ignoreRules && ignoreRules.ignores(entryRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Skip node_modules, .git directories, and other common directories to ignore
        const dirsToSkip = [
          "node_modules",
          ".git",
          "tmp",
          "log",
          "public/assets",
          "public/packs",
          "coverage",
          "vendor/bundle",
        ];
        if (dirsToSkip.includes(entry.name)) {
          continue;
        }
        walkDir(fullPath, entryRelativePath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        // Skip files with extensions we don't care about
        if (!config.extensions.includes(ext)) {
          continue;
        }

        // Skip files that are too large
        const fileStat = fs.statSync(fullPath);
        if (fileStat.size > config.maxFileSize) {
          console.warn(
            `Skipping ${entryRelativePath} (${formatBytes(
              fileStat.size
            )}) - exceeds max file size`
          );
          continue;
        }

        // Read file and count tokens
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const tokens = encoder.encode(content);
          const tokenCount = tokens.length;
          // Update stats
          stats.totalFiles++;
          stats.totalTokens += tokenCount;
          stats.totalBytes += fileStat.size;

          // Update extension stats
          if (!stats.byExtension[ext]) {
            stats.byExtension[ext] = { files: 0, tokens: 0 };
          }
          stats.byExtension[ext].files++;
          stats.byExtension[ext].tokens += tokenCount;

          // Track largest files
          stats.largestFiles.push({
            path: entryRelativePath,
            size: fileStat.size,
            tokens: tokenCount,
          });

          if (config.verbose) {
            console.log(`${entryRelativePath}: ${tokenCount} tokens`);
          }
        } catch (error) {
          console.error(
            `Error processing ${entryRelativePath}:`,
            error.message
          );
        }
      }
    }
  }

  // Start walking from root directory
  walkDir(rootDir);

  // Sort largest files
  stats.largestFiles.sort((a, b) => b.tokens - a.tokens);
  stats.largestFiles = stats.largestFiles.slice(0, 20); // Only keep top 20

  // Calculate average
  stats.avgTokensPerFile =
    stats.totalFiles > 0 ? stats.totalTokens / stats.totalFiles : 0;

  // Display summary
  console.log("\n==== Token Analysis Summary ====");
  console.log(`Total files analyzed: ${stats.totalFiles}`);
  console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);
  console.log(
    `Average tokens per file: ${Math.round(
      stats.avgTokensPerFile
    ).toLocaleString()}`
  );

  console.log("\n==== By File Extension ====");
  for (const [ext, data] of Object.entries(stats.byExtension)) {
    console.log(
      `${ext}: ${
        data.files
      } files, ${data.tokens.toLocaleString()} tokens (${Math.round(
        (data.tokens / stats.totalTokens) * 100
      )}%)`
    );
  }

  console.log("\n==== Largest Files (by tokens) ====");
  stats.largestFiles.forEach((file, index) => {
    console.log(
      `${index + 1}. ${file.path}: ${file.tokens.toLocaleString()} tokens`
    );
  });

  return stats;
}

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// CAG vs RAG Analysis
function analyzeForCAGvsRAG(stats) {
  console.log("\n==== CAG vs RAG Analysis ====");

  // Calculate embedding costs (rough estimate)
  // Assuming $0.0001 per 1000 tokens for embeddings
  const embeddingCostPer1K = 0.0001;
  const embeddingCost = (stats.totalTokens / 1000) * embeddingCostPer1K;

  console.log(`Estimated embedding cost: ${embeddingCost.toFixed(2)}`);

  // Detect framework type based on file extensions
  let frameworkType = config.frameworkType;
  if (frameworkType === "both") {
    const hasJSFiles =
      stats.byExtension[".js"] ||
      stats.byExtension[".jsx"] ||
      stats.byExtension[".ts"] ||
      stats.byExtension[".tsx"];
    const hasRubyFiles = stats.byExtension[".rb"] || stats.byExtension[".erb"];

    if (hasJSFiles && !hasRubyFiles) {
      frameworkType = "js";
    } else if (!hasJSFiles && hasRubyFiles) {
      frameworkType = "rails";
    } else {
      frameworkType = "both";
    }
  }

  console.log(`\nDetected framework type: ${frameworkType.toUpperCase()}`);

  // RAG considerations
  console.log("\nRAG (Retrieval-Augmented Generation) Considerations:");
  console.log("- Chunk size would need to be optimized for your codebase");
  console.log(
    "- Estimated number of chunks:",
    Math.ceil(stats.totalTokens / 1000)
  );
  console.log("- Vector database storage would be needed for embeddings");

  if (frameworkType === "rails" || frameworkType === "both") {
    console.log("\nRails-specific RAG considerations:");
    console.log(
      "- Convention over configuration makes Rails well-suited for RAG"
    );
    console.log("- Consider chunking by model/controller/view relationships");
    console.log(
      "- Rails routes and ActiveRecord relations are critical context to preserve"
    );
  }

  // CAG considerations
  console.log("\nCAG (Context-Augmented Generation) Considerations:");

  // Check if codebase is small enough for direct context
  const typicalContextWindow = 100000; // 100k tokens for many advanced models
  if (stats.totalTokens < typicalContextWindow) {
    console.log("- Your entire codebase could fit in a single context window");
    console.log("- Direct CAG may be simpler and more effective than RAG");
  } else {
    console.log("- Your codebase exceeds typical context windows");
    console.log("- Would require selective context loading or chunking");
    console.log("- Might need a hybrid approach with RAG for larger files");
  }

  if (frameworkType === "rails" || frameworkType === "both") {
    console.log("\nRails-specific CAG considerations:");
    console.log("- Loading related MVC components together can be effective");
    console.log(
      "- Schema.rb is critical context for almost all Rails operations"
    );
    console.log("- Routes.rb provides important application structure context");
  }

  // Recommendation
  console.log("\nRecommendation:");
  if (stats.totalTokens < typicalContextWindow) {
    console.log(
      "Based on token count, CAG would likely be simpler and more effective."
    );

    if (frameworkType === "rails" || frameworkType === "both") {
      console.log(
        "For Rails, consider loading these critical files in every context:"
      );
      console.log("- config/routes.rb");
      console.log("- db/schema.rb");
      console.log("- app/models/application_record.rb");
      console.log("- app/controllers/application_controller.rb");
    }
  } else if (stats.totalTokens < typicalContextWindow * 3) {
    console.log(
      "Your codebase is moderate-sized. A hybrid approach might work best:"
    );
    console.log("- Use CAG for the most important files");
    console.log("- Use RAG for the rest of the codebase");

    if (frameworkType === "rails" || frameworkType === "both") {
      console.log("\nFor Rails, consider a hybrid approach:");
      console.log("- Keep schema.rb, routes.rb, and application files in CAG");
      console.log("- Use RAG for specific models, controllers, and views");
      console.log(
        "- When retrieving a model, include its related controllers and views"
      );
    }
  } else {
    console.log("Your codebase is large. RAG would likely be more effective:");
    console.log("- More scalable for large codebases");
    console.log("- Better for targeted queries across many files");

    if (frameworkType === "rails" || frameworkType === "both") {
      console.log("\nFor a large Rails codebase:");
      console.log("- Consider chunking by related MVC components");
      console.log("- Always include schema context for model-related queries");
      console.log(
        "- Separate concerns by domain areas if your app is domain-driven"
      );
    }
  }
}

// Run the analysis
const rootDir = process.argv[2] || ".";
console.log("Starting analysis with root directory:", rootDir);
console.log("Absolute path:", path.resolve(rootDir));

if (!fs.existsSync(rootDir)) {
  console.error(`ERROR: Directory does not exist: ${rootDir}`);
  process.exit(1);
}

analyzeCodebase(rootDir)
  .then((stats) => {
    analyzeForCAGvsRAG(stats);
  })
  .catch((error) => {
    console.error("Analysis failed:", error);
  });
