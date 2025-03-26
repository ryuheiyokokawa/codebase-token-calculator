# Codebase Token Calculator

This tool analyzes your JS/TS React frontend or Ruby on Rails codebase to calculate token counts, helping you decide between Context-Augmented Generation (CAG) vs Retrieval-Augmented Generation (RAG) approaches.
Written by Claude really, I didn't do much.

## Features

- Walks through your codebase directory
- Respects `.gitignore` rules
- Skips hidden files and directories
- Counts tokens for relevant files (JS, TS, JSX, TSX, Ruby, ERB, etc.)
- Provides detailed statistics and analysis
- Auto-detects framework type (JavaScript or Rails)
- Offers framework-specific recommendations for CAG vs RAG

## Setup

1. Create a new directory for this tool
2. Save the `token-calculator.js` and `package.json` files to this directory
3. Install dependencies:

```bash
npm install
```

## Usage

Run the tool by pointing it to your codebase directory:

```bash
npm run analyze -- /path/to/your/codebase
```

Or run it on the current directory:

```bash
npm run analyze
```

## Understanding the Results

The tool will provide:

- Total token count across your codebase
- Breakdown by file extension
- List of largest files by token count
- Analysis of CAG vs RAG suitability
- Recommendations based on your codebase size

## CAG vs RAG Decision Guide

**Context-Augmented Generation (CAG)**:

- Simpler to implement - just load code into context
- Works well for smaller codebases
- More precise for code understanding
- No need for vector database infrastructure

**Retrieval-Augmented Generation (RAG)**:

- More scalable for large codebases
- Better for targeted queries
- Requires embedding and vector database setup
- More complex retrieval logic needed

## Configuration

You can modify the configuration options at the top of the `token-calculator.js` file:

- Change `encodingName` to match your LLM's tokenizer
- Adjust `extensions` to include/exclude file types
- Change `maxFileSize` to handle larger files
- Toggle `verbose` for detailed per-file output
- Toggle `respectGitignore` to control gitignore rule handling
- Toggle `skipHidden` to control whether hidden files are analyzed
- Set `frameworkType` to 'js', 'rails', or 'both' to get appropriate recommendations

## Rails-Specific Tips

When analyzing Rails codebases:

1. The script will automatically identify Rails by the presence of .rb and .erb files
2. Rails-specific directories like tmp, log, and vendor/bundle are automatically skipped
3. The analysis will provide Rails-specific recommendations:
   - How to chunk MVC components together
   - Which critical files to always include (schema.rb, routes.rb)
   - How to handle ActiveRecord relationships

For large Rails applications, you might want to analyze specific subdirectories:

```bash
# Analyze just the models
npm run analyze -- /path/to/rails/app/app/models

# Analyze a specific domain area
npm run analyze -- /path/to/rails/app/app/controllers/admin
```
