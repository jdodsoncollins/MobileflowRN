#!/usr/bin/env node
/**
 * Xcode 26 "Project Document" compatibility rewrites PBXShellScriptBuildPhase.shellScript
 * from a string to an array of lines. CocoaPods xcodeproj 1.27–1.28 still requires a string
 * (CocoaPods/CocoaPods#12794) and `pod install` dies.
 *
 * Flatten arrays back to strings and keep objectVersion at Expo's 54 so Xcode is less
 * likely to rewrite them on the next save. Do not accept Xcode's format upgrade prompt.
 */
import fs from 'node:fs';
import path from 'node:path';

function defaultPbxproj() {
  const ios = path.resolve('ios');
  if (!fs.existsSync(ios)) return path.resolve('ios', 'App.xcodeproj', 'project.pbxproj');
  const found = fs.readdirSync(ios).find((name) => name.endsWith('.xcodeproj'));
  return found
    ? path.join(ios, found, 'project.pbxproj')
    : path.join(ios, 'App.xcodeproj', 'project.pbxproj');
}

const pbxproj = process.argv[2] ? path.resolve(process.argv[2]) : defaultPbxproj();

if (!fs.existsSync(pbxproj)) {
  console.error(`No pbxproj at ${pbxproj}`);
  process.exit(1);
}

let src = fs.readFileSync(pbxproj, 'utf8');
const before = src;

src = src.replace(/shellScript = \(\s*([\s\S]*?)\s*\);/g, (_all, body) => {
  const lines = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(body))) lines.push(m[1]);
  return `shellScript = "${lines.join('\\n')}";`;
});

src = src.replace(/^\tobjectVersion = \d+;$/m, '\tobjectVersion = 54;');
src = src.replace(/^\t\t\tpreferredProjectObjectVersion = \d+;\n/m, '');

if (src === before) {
  console.log(`pbxproj already CocoaPods-safe: ${pbxproj}`);
  process.exit(0);
}

fs.writeFileSync(pbxproj, src);
console.log(`Flattened shellScript arrays in ${pbxproj}`);
