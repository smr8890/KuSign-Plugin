import { Config } from "../components/index.js";
import { startApiService, stopApiService, sendRequest } from "../utils/api.js";

export class TokenRefresher extends plugin {
    constructor() {
        super({
            name: "Token刷新",
            event: "message",
            priority: 10,
            rule: [
                {
                    reg: "^#?酷狗刷新token$",
                    fnc: "refreshToken",
                    log: true,
                }
            ]
        })

        this.task = {
            cron: Config.getcfg.token_refresh_time,
            name: "KuSign Token刷新任务",
            fnc: () => this.refreshToken()
        }
    }

    async refreshToken(e) {
        //启动API服务
        try {
            await startApiService();
        } catch (error) {
            if (e?.user_id) {
                e.reply("启动API服务失败，请查看日志！");
            }
            logger.error("启动API服务失败:", error);
            return;
        }
        if (e?.user_id) {
            //如果是手动执行，直接刷新当前用户的token
            const userId = e.user_id;
            const redis_key = `Yz:kusign:userinfo:${userId}`;
            let userInfo = await redis.get(redis_key);
            if (!userInfo) {
                e.reply("您还未登录，请先登录！");
                return;
            }
            userInfo = JSON.parse(userInfo);
            //调用刷新token接口，/login/refresh_token，必选参数：token: 用户登录成功后获取的token
            try {
                const headers = { "cookies": `token=${userInfo.token};userid=${userInfo.userid}` };
                const refreshResponse = await sendRequest(`/login/token?token=${userInfo.token}&userid=${userInfo.userid}&timestrap=${Date.now()}`, "GET", headers);
                if (refreshResponse?.status === 1) {
                    const newToken = refreshResponse.data.token;
                    userInfo.token = newToken;
                    userInfo.token_time = Date.now();
                    await redis.set(redis_key, JSON.stringify(userInfo));
                }
                e.reply("Token刷新成功！");
            } catch (error) {
                e.reply("Token刷新失败，请查看日志！");
                logger.error("Token刷新失败:", error);
            }
        } else {
            //如果是定时任务执行，获取所有登录过的用户id，依次刷新每个用户的token
            let userIds = [];
            const users_key = "Yz:kusign:users";
            let users = await redis.get(users_key);
            userIds = users ? JSON.parse(users) : [];
            for (const userId of userIds) {
                const redis_key = `Yz:kusign:userinfo:${userId}`;
                let userInfo = await redis.get(redis_key);
                if (!userInfo) {
                    logger.info(`用户${userId}未找到登录信息，跳过Token刷新`);
                    continue;
                }
                userInfo = JSON.parse(userInfo);
                try {
                    const headers = { "cookies": `token=${userInfo.token};userid=${userInfo.userid}` };
                    const refreshResponse = await sendRequest(`/login/token?token=${userInfo.token}&userid=${userInfo.userid}&timestrap=${Date.now()}`, "GET", headers);
                    if (refreshResponse?.status === 1) {
                        const newToken = refreshResponse.data.token;
                        userInfo.token = newToken;
                        userInfo.token_time = Date.now();
                        await redis.set(redis_key, JSON.stringify(userInfo));
                        logger.info(`用户${userId} Token刷新成功`);
                    }
                } catch (error) {
                    logger.error(`用户${userId} Token刷新失败:`, error);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        //关闭API服务
        try {
            await stopApiService();
        } catch (error) {
            logger.error("关闭API服务失败:", error);
        }
    }
}