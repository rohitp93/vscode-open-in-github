// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

var VsCode = require('vscode');
var Window = VsCode.window;
var commands = VsCode.commands;
var workspace = VsCode.workspace;
var Position = VsCode.Position;

var path = require('path');
var fs = require('fs');
var git = require('parse-git-config');
var open = require('open');
var copy = require('copy-paste').copy;
var gitRev = require('git-rev-2');
var findParentDir = require('find-parent-dir');

const gitProvider = require('./gitProvider');
const requireSelectionForLines = workspace.getConfiguration('openInGitHub').get('requireSelectionForLines');

function getGitProviderLink(cb, fileFsPath, lines, pr) {
    var cwd = workspace.rootPath;
    var repoDir = findParentDir.sync(workspace.rootPath, '.git') || cwd;

    git({
        cwd: repoDir
    }, function (err, config) {
        const rawUri = config['remote \"origin\"'].url;
        var provider = null;

        try {
            provider = gitProvider(rawUri);
        } catch (e) {
            let errmsg = e.toString();
            Window.showWarningMessage(`Unknown Git provider. ${errmsg}`);
            return;
        }

        gitRev.branch(cwd, function (branchErr, branch) {
            if (branchErr || !branch)
                branch = 'master';

            let subdir = fileFsPath ? fileFsPath.substring(workspace.rootPath.length).replace(/\"/g, "") : undefined;

            if (repoDir !== cwd) {
                // The workspace directory is a subdirectory of the git repo folder so we need to prepend the the nested path
                var repoRelativePath = cwd.replace(repoDir, "/");
                subdir = repoRelativePath + subdir;
            }

            if (pr){
                try {
                    cb(provider.prUrl(branch));
                }catch (e){
                    Window.showWarningMessage(e.toString());
                    return;
                }
            }
            else {
                if (lines) {
                    if (lines[0] == lines[1]) {
                        cb(provider.webUrl(branch, subdir, lines[0]));
                    }
                    else {
                        cb(provider.webUrl(branch, subdir, lines[0], lines[1]));
                    }
                }
                else {
                    cb(provider.webUrl(branch, subdir));
                }
            }
        });
    });
}



function getGitProviderLinkForFile(fileFsPath, cb) {
    getGitProviderLink(cb, fileFsPath);
}

function getGitProviderLinkForCurrentEditorLines(cb) {
    var editor = Window.activeTextEditor;
    if (editor) {
        var fileFsPath = editor.document.uri.fsPath;

        if (includeLines(editor)) {
            getGitProviderLink(cb, fileFsPath, getSelectedLines(editor));
        }
        else {
            getGitProviderLinkForFile(fileFsPath, cb);
        }
    }
}

function includeLines(editor) {
    return !requireSelectionForLines || !editor.selection.isEmpty;
}

function getSelectedLines(editor) {
    var anchorLineIndex = editor.selection.anchor.line + 1;
    var activeLineIndex = editor.selection.active.line + 1;

    return [anchorLineIndex, activeLineIndex].sort();
}

function getGitProviderLinkForRepo(cb) {
    getGitProviderLink(cb);
}

function getGitProviderPullRequest(cb) {
    getGitProviderLink(cb, undefined, undefined, true);
}


function branchOnCallingContext(args, cb, pr) {
    if (pr) {
        getGitProviderPullRequest(cb);
    }
    else if (args && args.fsPath) {
        getGitProviderLinkForFile(args.fsPath, cb);
    }
    else if (Window.activeTextEditor) {
        getGitProviderLinkForCurrentEditorLines(cb);
    }
    else {
        getGitProviderLinkForRepo(cb);
    }
}


function openInGitProvider(args) {
    branchOnCallingContext(args, open);
}

function copyGitProviderLinkToClipboard(args) {
    branchOnCallingContext(args, copy);
}

function openPrGitProvider(args) {
    branchOnCallingContext(args, open, true);
}

//TODO: rename openInGitHub to openInGitProvider
function activate(context) {
    context.subscriptions.push(commands.registerCommand('extension.openInGitHub', openInGitProvider));
    context.subscriptions.push(commands.registerCommand('extension.copyGitHubLinkToClipboard', copyGitProviderLinkToClipboard));
    context.subscriptions.push(commands.registerCommand('extension.openPrGitProvider', openPrGitProvider));
}

exports.activate = activate;
