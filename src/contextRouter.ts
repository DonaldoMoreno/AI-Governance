import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ContextBundle } from "./contextBuilder";
import { TASK_MODE_CONFIGS } from "./taskModeResolver";

export interface RoutedContext {
  taskLabel: string;
  taskOutputContractFile: string;
  outputContractExists: boolean;
  priorityScopeNames: string[];
}

/**
 * Route context based on the active task mode.
 * Determines which output contract file applies and which governance scopes
 * are prioritised for the current mode.  All resolution is deterministic — no network calls.
 */
export function routeContext(
  workspaceFolder: vscode.WorkspaceFolder,
  bundle: ContextBundle
): RoutedContext {
  const config = TASK_MODE_CONFIGS[bundle.taskMode];
  const root = workspaceFolder.uri.fsPath;
  const contractAbs = path.join(root, config.outputContractFile);

  return {
    taskLabel: config.label,
    taskOutputContractFile: config.outputContractFile,
    outputContractExists: fs.existsSync(contractAbs),
    priorityScopeNames: config.defaultScopes,
  };
}
