// test/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { generateContext } from '../src/generateContext';
import { FileNode } from '../src/models/FileNode';
import * as fs from 'fs';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Generate Context Function', () => {
        const workspaceRoot = path.resolve(__dirname, 'testWorkspace');
        const outputFile = 'test_context.txt';

        // Setup: Create a mock workspace
        fs.mkdirSync(workspaceRoot, { recursive: true });
        fs.writeFileSync(path.join(workspaceRoot, 'testFile.js'), 'console.log("Hello World");');
        fs.writeFileSync(path.join(workspaceRoot, '__init__.py'), '');

        const selectedFiles: FileNode[] = [
            {
                label: 'testFile.js',
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(path.join(workspaceRoot, 'testFile.js')),
                checked: true
            },
            {
                label: '__init__.py',
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(path.join(workspaceRoot, '__init__.py')),
                checked: true
            }
        ];

        // Execute
        generateContext(workspaceRoot, outputFile, selectedFiles, [], [], false);

        // Verify
        const outputPath = path.join(workspaceRoot, outputFile);
        assert.ok(fs.existsSync(outputPath), 'Output file was not created.');

        const content = fs.readFileSync(outputPath, 'utf-8');
        assert.ok(content.includes('File Tree:'), 'File Tree section missing.');
        assert.ok(content.includes('Files:'), 'Files section missing.');
        assert.ok(content.includes('testFile.js'), 'File entry missing.');
        assert.ok(content.includes('__init__.py'), '__init__.py entry missing.');

        // Cleanup
        fs.unlinkSync(path.join(workspaceRoot, 'testFile.js'));
        fs.unlinkSync(path.join(workspaceRoot, '__init__.py'));
        fs.unlinkSync(outputPath);
        fs.rmdirSync(workspaceRoot);
    });
});