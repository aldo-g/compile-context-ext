// src/generateContext.ts
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
 * Generates a context file containing the file tree and contents of selected files.
 * @param workspaceRoot The root directory of the workspace.
 * @param outputFile The name of the output file.
 * @param selectedFiles An array of selected FileNodes.
 * @param excludeFiles An array of filenames to exclude.
 * @param excludePaths An array of directory paths to exclude.
 * @param excludeHidden Whether to exclude hidden files and directories.
 */
export function generateContext(
    workspaceRoot: string,
    outputFile: string,
    selectedFiles: FileNode[],
    excludeFiles: string[],
    excludePaths: string[],
    excludeHidden: boolean
) {
    let fileTree = 'File Tree:\n';
    let filesContent = '\nFiles:\n';

    console.log('Starting context generation...');

    // Log selected files for debugging
    console.log(`Selected Files (${selectedFiles.length}):`);
    selectedFiles.forEach(file => {
        console.log(`- ${file.uri.fsPath}`);
    });

    // Build hierarchical tree structure from selected files
    const treeRoot: TreeNode = { name: '', children: new Map(), isFile: false };

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
                console.log(`Added ${isFile ? 'file' : 'directory'}: ${part}`);
            }
            currentNode = currentNode.children.get(part)!;
        });
    });

    // Serialize the tree structure into a string
    fileTree += serializeTree(treeRoot, '');

    console.log(`Constructed File Tree:\n${fileTree}`);

    // Collect file contents
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        const baseName = path.basename(file.uri.fsPath);

        // Ensure it's a file before attempting to read
        if (isDirectory(file.uri.fsPath)) {
            console.warn(`Skipping directory: ${relativePath}`);
            return; // Skip directories
        }

        if (baseName === '__init__.py') {
            filesContent += `\n--- Start of ${relativePath} ---\n`;
        } else {
            try {
                const content = fs.readFileSync(file.uri.fsPath, 'utf-8');
                filesContent += `\n--- Start of ${relativePath} ---\n${content}\n`;
                console.log(`Added content for file: ${relativePath}`);
            } catch (error) {
                filesContent += `\n--- Start of ${relativePath} ---\nError reading file: ${error}\n`;
                console.error(`Error reading file ${relativePath}: ${error}`);
            }
        }
    });

    console.log(`Files Content:\n${filesContent}`);

    // Write to output file
    const outputPath = path.join(workspaceRoot, outputFile);
    try {
        fs.writeFileSync(outputPath, `${fileTree}\n${filesContent}`);
        vscode.window.showInformationMessage(`Context successfully written to ${outputFile}`);
        console.log(`Context file written to ${outputPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to write to output file '${outputFile}': ${error}`);
        console.error(`Failed to write to output file '${outputFile}': ${error}`);
    }
}

/**
 * Serializes the tree structure into a formatted string.
 * @param node The current node in the tree.
 * @param prefix The string prefix for indentation and connectors.
 * @returns A string representing the serialized tree.
 */
function serializeTree(node: TreeNode, prefix: string): string {
    let result = '';
    const children = Array.from(node.children.values());
    const total = children.length;

    children.forEach((child, index) => {
        const isLast = index === total - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        console.log(`Serializing child: ${child.name}, isFile: ${child.isFile}, isLast: ${isLast}`);
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
        console.error(`Error accessing path ${filePath}: ${err}`);
        return false;
    }
}