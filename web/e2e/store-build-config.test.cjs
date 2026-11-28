const { strict: assert } = require('node:assert');
const { test } = require('node:test');
const { resolve } = require('node:path');
const { workspaces } = require('@angular-devkit/core');
const { NodeJsSyncHost } = require('@angular-devkit/core/node');
const { WorkspaceNodeModulesArchitectHost } = require('@angular-devkit/architect/node');

test('Store no-payment composes with editorial in either order', async () => {
  const root = resolve(__dirname, '..');
  const { workspace } = await workspaces.readWorkspace(root, workspaces.createWorkspaceHost(new NodeJsSyncHost()));
  const architect = new WorkspaceNodeModulesArchitectHost(workspace, root);
  for (const configuration of ['production,editorial,no-payment', 'production,no-payment,editorial']) {
    const options = await architect.getOptionsForTarget({ project: 'store', target: 'build', configuration });
    assert(options.fileReplacements.some(({ with: file }) => file.endsWith('/editorial-config.enabled.ts')), configuration);
    assert.equal(options.define.CAMBA_PAYMENTS_ENABLED, 'false', configuration);
  }
});
