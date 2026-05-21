import { Config } from "../components/index.js";
import { startApiService, stopApiService, sendRequest } from "../utils/api.js";
const sign_time = Config.getcfg.sign_time

export class Sign extends plugin {
    constructor() {
        super({
            name: "酷狗自动签到",
            event: "message",
            priority: 10,
            rule: [
                {
                    reg: "^#?开启酷狗签到$",
                    fnc: "startSign",
                    log: true,
                },
                {
                    reg: "^#?关闭酷狗签到$",
                    fnc: "stopSign",
                    log: true,
                },
                {
                    reg: "^#?酷狗签到$",
                    fnc: "signTask",
                    log: true
                }
            ]
        });

        this.task = {
            cron: sign_time,
            name: "KuSign签到任务",
            fnc: () => this.signTask()
        }
    }

    async startSign(e) {
        const userId = e.user_id;
        //1.检查用户是否已登录，检查redis中是否存在用户信息，key为：Yz:kusign:userinfo:userid
        const redis_key = `Yz:kusign:userinfo:${userId}`;
        let userInfo = await redis.get(redis_key);
        if (!userInfo) {
            e.reply("您还未登录，请先登录！");
            return;
        }

        //2.如果已登录，设置用户的自动签到状态为true，保存到redis中
        userInfo = JSON.parse(userInfo);
        userInfo.auto_sign = true;
        await redis.set(redis_key, JSON.stringify(userInfo));
        e.reply("已开启酷狗概念版自动签到！");
    }

    async stopSign(e) {
        const userId = e.user_id;
        //1.检查用户是否已登录，检查redis中是否存在用户信息，key为：Yz:kusign:userinfo:userid
        const redis_key = `Yz:kusign:userinfo:${userId}`;
        let userInfo = await redis.get(redis_key);
        if (!userInfo) {
            e.reply("您还未登录，请先登录！");
            return;
        }

        //2.如果已登录，设置用户的自动签到状态为false，保存到redis中
        userInfo = JSON.parse(userInfo);
        userInfo.auto_sign = false;
        await redis.set(redis_key, JSON.stringify(userInfo));
        e.reply("已关闭酷狗概念版自动签到！");
    }

    async signTask(e) {
        //1.如果参数e存在，说明是手动执行签到任务，参数e包含用户id；如果参数e不存在，说明是定时执行签到任务，此时需要从redis中获取所有需要执行签到任务的用户id，key为：Yz:kusign:sign_task_users，value为一个数组，包含所有需要执行签到任务的用户id
        let userIds = [];
        if (e?.user_id) {
            userIds.push(e.user_id);
        } else {
            const signTaskUsers_key = "Yz:kusign:users";
            let signTaskUsers = await redis.get(signTaskUsers_key);
            userIds = signTaskUsers ? JSON.parse(signTaskUsers) : [];
        }

        //2.遍历所有需要执行签到任务的用户id，依次执行签到任务
        //启动API服务
        try {
            await startApiService();
        } catch (error) {
            logger.error("启动API服务失败:", error);
            return;
        }
        for (const userId of userIds) {
            //2.1从redis中获取用户信息，key为：Yz:kusign:userinfo:userid
            const redis_key = `Yz:kusign:userinfo:${userId}`;
            let userInfo = await redis.get(redis_key);
            if (typeof userInfo === "string") {
                try {
                    userInfo = JSON.parse(userInfo);
                } catch (err) {
                    logger.warn(`用户${userId}登录信息解析失败，跳过签到任务`);
                    continue;
                }
            }
            //当auto_sign为false且非手动执行时，跳过签到任务
            if (!e?.user_id && userInfo.auto_sign === false) {
                // logger.info(`用户${userId}未开启自动签到，跳过签到任务`);
                continue;
            }
            // console.log("签到任务，获取到的用户信息:", userInfo);
            if (!userInfo || !userInfo.token || !userInfo.userid) {
                logger.warn(`用户${userId}未找到登录信息，跳过签到任务`);
                continue;
            }

            //2.2使用用户信息中的token和userid调用API接口，获取用户详情，验证登录信息是否有效，如果无效，跳过签到任务；如果有效，继续执行签到任务
            const headers = { 'cookie': 'token=' + userInfo.token + '; userid=' + userInfo.userid }
            // console.log("签到任务，使用的请求头:", headers);
            const userDetail = await sendRequest(`/user/detail?timestrap=${Date.now()}`, "GET", headers);
            if (userDetail?.data?.nickname == null) {
                logger.warn(`用户${userId}的登录信息无效，跳过签到任务`);
                continue;
            }

            //领取每日畅听会员
            const receiveDay = new Date().toISOString().slice(0, 10); // 格式为 YYYY-MM-DD，如 2026-01-30
            // console.log(`签到任务，领取每日畅听会员，使用的日期参数:`, receiveDay);
            const signResult = await sendRequest(`/youth/day/vip?receive_day=${receiveDay}`, "GET", headers);
            if (signResult.status === 1) {
                logger.info(`用户${userDetail.data.nickname}签到成功:`);
            }
            // if (e?.user_id) {
            //     e.reply(`用户${userDetail.data.nickname}签到结果：` + (signResult.status === 1 ? "签到成功！" : "签到失败或已签到过！"));
            // }

            //尝试升级会员
            const upgradeResult = await sendRequest(`/youth/day/vip/upgrade`, "GET", headers);
            if (upgradeResult.status === 1) {
                logger.info(`用户${userDetail.data.nickname}会员升级成功:`);
            }
            // if (e?.user_id) {
            //     e.reply(`用户${userDetail.data.nickname}会员升级结果：` + (upgradeResult.status === 1 ? "升级成功！" : "升级失败或已是高级会员！"));
            // }

            //输出会员信息
            const vipDetailResult = await sendRequest(`/user/vip/detail`, "GET", headers);
            if (vipDetailResult.status === 1) {
                logger.info(`VIP到期时间：${vipDetailResult.data.busi_vip[0].vip_end_time}`);
            }

            //构造回复消息
            if (e?.user_id) {
                let replyMsg = `用户${userDetail.data.nickname}签到结果：` + (signResult.status === 1 ? "签到成功！" : "签到失败或已签到过！") + "\n";
                replyMsg += `会员升级结果：` + (upgradeResult.status === 1 ? "升级成功！" : "升级失败或已是高级会员！") + "\n";
                if (vipDetailResult.status === 1) {
                    replyMsg += `VIP到期时间：${vipDetailResult.data.busi_vip[0].vip_end_time}`;
                }
                e.reply(replyMsg);
            }

            //延迟5秒，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        //3.关闭API服务
        try {
            await stopApiService();
        } catch (error) {
            logger.error("关闭API服务失败:", error);
        }
    }
}