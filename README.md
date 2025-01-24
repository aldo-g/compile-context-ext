# Context Compilor

Compile file tree and file contents for coding assistance with LLMs within VSCode.

## Features

- **Interactive File Tree:** Browse your project's file structure with checkboxes to include or exclude specific files and directories.
- **Compile Context File:** Create a comprehensive context file (`file_context.txt`) based on your selections, useful for large language models (LLMs).
- **Configuration Options:** Customize exclusions and output file name via VSCode settings.

## Usage

1. **Open Your Project:**
   - Open the folder you want to compile context for in VSCode.

2. **Access Context Compilor:**
   - Navigate to the **"Context Compilor"** view in the Explorer pane.

3. **Select Files and Directories:**
   - Use the checkboxes to include or exclude specific files and directories.

4. **Compile Context:**
   - Click the **"Compile Context"** button in the view's title bar.
   - A `file_context.txt` will be compiled in the workspace root, containing the file tree and file contents.

## Configuration

Access the extension's settings to customize its behavior:

- **Exclude Files:**
  - List of filenames to exclude from the context.
  
- **Exclude Paths:**
  - List of directory paths to exclude from the context.
  
- **Output File:**
  - Name of the output context file.
  
- **Exclude Hidden:**
  - Toggle to include or exclude hidden files and directories.

## Installation

Install the extension from the [VSCode Marketplace](https://marketplace.visualstudio.com/vscode) or via the `.vsix` file.

## Development

### Prerequisites

- **Node.js** (v14 or later)
- **npm** (v6 or later)
- **Visual Studio Code**

### Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/aldo-g/context-gen-ext.git
   cd context-gen-extnpm install