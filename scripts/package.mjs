import { build, Platform } from 'electron-builder';
import config from '../electron-builder.cjs';
import pkg from '../package.json' with {type:'json'};
await build({ targets: process.argv[2] === 'mac' ? Platform.MAC.createTarget() : Platform.WINDOWS.createTarget(),
  config:{...config,directories:{...config.directories,output:process.env.TCHIM_BUILD_OUTPUT??`release/${pkg.version}`}}, publish: 'never' });
