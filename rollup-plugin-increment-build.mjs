import fs from 'fs';
import path from 'path';

/**
 * Rollup plugin to increment build number on each build
 */
export default function incrementBuild() {
  return {
    name: 'increment-build',
    buildStart() {
      const buildInfoPath = path.resolve('build-info.json');

      let buildInfo = { buildNumber: 0 };

      // Read existing build info
      if (fs.existsSync(buildInfoPath)) {
        const content = fs.readFileSync(buildInfoPath, 'utf-8');
        buildInfo = JSON.parse(content);
      }

      // Increment build number
      buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;

      // Write back to file
      fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

      console.log(`Build #${buildInfo.buildNumber}`);
    }
  };
}
