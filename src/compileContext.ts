// src/compileContext.ts
/**
 * Compiles a context file containing the file tree and contents of selected files.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileNode } from './models/FileNode';

/**
 * Interface representing a node in the file tree.
 */
interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
    isFile: boolean;
}

/**
 * Compiles a context file containing the file tree and contents of selected files.
 * @param workspaceRoot The root directory of the workspace.
 * @param outputFile The name of the output file.
 * @param selectedFiles An array of selected FileNodes.
 * @param excludeFiles An array of filenames to exclude.
 * @param excludePaths An array of directory paths to exclude.
 * @param excludeHidden Whether to exclude hidden files and directories.
 */
export async function compileContext(
    workspaceRoot: string,
    outputFile: string,
    selectedFiles: FileNode[],
    excludeFiles: string[],
    excludePaths: string[],
    excludeHidden: boolean
): Promise<void> {
    let fileTree = 'File Tree:\n';
    let filesContent = '\nFiles:\n';

    const treeRoot: TreeNode = { name: '', children: new Map(), isFile: false };

    // Build the tree structure from selected files
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        let currentNode = treeRoot;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            if (!currentNode.children.has(part)) {
                currentNode.children.set(part, {
                    name: part,
                    children: new Map(),
                    isFile: isFile,
                });
            }
            currentNode = currentNode.children.get(part)!;
        });
    });

    // Log the tree structure before serialization for debugging
    vscode.window.showInformationMessage(`Serializing tree with ${selectedFiles.length} files.`);
    console.log('Tree Structure:', JSON.stringify(treeRoot, null, 2));

    if (treeRoot.children.size === 0) {
        vscode.window.showErrorMessage('No files to serialize. The tree structure is empty.');
        return;
    }

    // Serialize the tree structure
    fileTree += serializeTree(treeRoot, '');

    // Serialize the contents of selected files
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        const baseName = path.basename(file.uri.fsPath);

        if (isDirectory(file.uri.fsPath)) {
            // Skip directories for content serialization
            return;
        }

        try {
            const content = fs.readFileSync(file.uri.fsPath, 'utf-8');
            filesContent += `\n--- Start of ${relativePath} ---\n${content}\n`;
            console.log(`Read content from: ${relativePath}`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                filesContent += `\n--- Start of ${relativePath} ---\nError reading file: ${error.message}\n`;
                console.error(`Error reading file ${relativePath}: ${error.message}`);
            } else {
                filesContent += `\n--- Start of ${relativePath} ---\nError reading file due to an unknown error.\n`;
                console.error(`Unknown error reading file ${relativePath}`);
            }
        }
    });

    // Write the serialized tree and file contents to the output file
    const outputPath = path.join(workspaceRoot, outputFile);
    try {
        fs.writeFileSync(outputPath, `${fileTree}\n${filesContent}`);
        vscode.window.showInformationMessage(`Context successfully written to ${outputFile}`);
        console.log(`Context file created at: ${outputPath}`);
    } catch (error: unknown) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to write to output file '${outputFile}': ${error.message}`);
            console.error(`Error writing to output file '${outputFile}': ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to write to output file '${outputFile}' due to an unknown error.`);
            console.error(`Unknown error writing to output file '${outputFile}'`);
        }
    }
}

/**
 * Serializes the tree structure into a formatted string.
 * Ensures directories are listed first in alphabetical order, followed by files.
 * @param node The current node in the tree.
 * @param prefix The string prefix for indentation and connectors.
 * @returns A string representing the serialized tree.
 */
function serializeTree(node: TreeNode, prefix: string): string {
    let result = '';
    const children = Array.from(node.children.values());

    // Sort children: directories first, then files, both in alphabetical order (case-insensitive)
    children.sort((a, b) => {
        if (a.isFile === b.isFile) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        return a.isFile ? 1 : -1; // Directories come first
    });

    const total = children.length;

    children.forEach((child, index) => {
        const isLast = index === total - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        result += `${prefix}${connector}${child.name}${child.isFile ? '' : '/'}\n`;

        if (!child.isFile) {
            result += serializeTree(child, newPrefix);
        }
    });

    return result;
}

/**
 * Determines if a given path is a directory.
 * @param filePath The path to check.
 * @returns True if it's a directory, else false.
 */
function isDirectory(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch (err) {
        return false;
    }
}