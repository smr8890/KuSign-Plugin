import lodash from 'lodash';
import path from 'path';
import { Config } from './components/index.js';
import { Plugin_Path } from './components/index.js';

export function supportGuoba() {
    return {
        pluginInfo: {
            name: 'KuSign-Plugin',
            title: 'KuSign-Plugin',
            author: '@smr8890',
            authorLink: 'https://github.com/smr8890',
            link: 'https://github.com/smr8890/KuSign-Plugin',
            isV3: true,
            isV2: false,
            description: '酷狗概念版签到',
        },
        configInfo: {
            schemas: [
                {
                    field: 'api_address',
                    label: 'api接口地址',
                    bottomHelpMessage: '请填写接口地址',
                    component: 'Input',
                    componentProps: {
                        placeholder: '请填写接口地址',
                    }
                },
                {
                    field: 'api_port',
                    label: 'api端口',
                    bottomHelpMessage: '请填写端口',
                    component: 'Input',
                    componentProps: {
                        placeholder: '请填写端口',
                    }
                },
                {
                    field: 'sign_time',
                    label: '自动签到时间',
                    bottomHelpMessage: '请填写或选择定时表达式',
                    component: 'EasyCron',
                    componentProps: {
                        placeholder: '请填写自动签到时间',
                    }
                },
                {
                    field: 'token_refresh_time',
                    label: 'token刷新时间',
                    bottomHelpMessage: '请填写或选择定时表达式',
                    component: 'EasyCron',
                    componentProps: {
                        placeholder: '请填写token刷新时间',
                    }
                }
            ],
            getConfigData() {
                return Config.getConfig('config');
            },
            setConfigData(data, { Result }) {
                const config = Config.getConfig('config');

                for (const key in data) {
                    const split = key.split('.');
                    const configName = 'config';
                    const configKey = split[0];

                    if (lodash.isEqual(config[configKey], data[key])) continue;
                    Config.modify(configName, configKey, data[key]);
                }
                return Result.ok({}, '配置已更新成功');
            }
        }
    }
}