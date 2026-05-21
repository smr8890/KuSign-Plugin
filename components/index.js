const _PATH = process.cwd().replace(/\\/g, "/");
const Plugin_Name = "KuSign-Plugin";
const Plugin_Path = `${_PATH}/plugins/${Plugin_Name}`;
import Config from './Config.js';
import YamlReader from './YamlReader.js';

export { _PATH, Plugin_Name, Plugin_Path, Config, YamlReader };