// src/generateContext.ts
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileNode } from './models/FileNode';

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

    // Build file tree string
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        fileTree += `├── ${relativePath}\n`;
    });

    // Collect file contents
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        const baseName = path.basename(file.uri.fsPath);

        if (baseName === '__init__.py') {
            filesContent += `\n--- Start of ${relativePath} ---\n`;
        } else {
            try {
                const content = fs.readFileSync(file.uri.fsPath, 'utf-8');
                filesContent += `\n--- Start of ${relativePath} ---\n${content}\n`;
            } catch (error) {
                filesContent += `\n--- Start of ${relativePath} ---\nError reading file: ${error}\n`;
            }
        }
    });

    // Write to output file
    const outputPath = path.join(workspaceRoot, outputFile);
    try {
        fs.writeFileSync(outputPath, `${fileTree}\n${filesContent}`);
        vscode.window.showInformationMessage(`Context successfully written to ${outputFile}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to write to output file '${outputFile}': ${error}`);
    }
}