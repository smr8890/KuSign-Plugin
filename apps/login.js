import { startApiService, stopApiService, sendRequest } from "../utils/api.js";
export class Login extends plugin {
    constructor() {
        super({
            name: "登录",
            event: "message",
            priority: 10,
            rule: [
                {
                    reg: "^#?酷狗扫码登录$",
                    fnc: "login",
                    log: true,
                }
            ],
        })
    }

    async login(e) {
        //启动API服务
        try {
            await startApiService();
        } catch (error) {
            e.reply("启动API服务失败");
            logger.error("启动API服务失败:", error);
            return;
        }
        //1. 调用二维码key接口获取key，/login/qr/key,返回qrcode，qrcode_img
        const keyResponse = await sendRequest("/login/qr/key?timestrap=" + Date.now(), "GET", { "Content-Type": "application/json" });
        // console.log(keyResponse)
        const key = keyResponse.data.qrcode;
        const qrcode_img = keyResponse.data.qrcode_img;
        const base64 = qrcode_img.includes(",") ? qrcode_img.split(",")[1] : qrcode_img;
        const qrImage = `base64://${base64}`;

        //发送二维码图片给用户扫码
        e.reply("请扫码登录：");
        e.reply(segment.image(qrImage));

        //3. 轮询登录状态接口，/login/qr/check，必选参数：key: ,由第一个接口生成，
        // 轮询此接口可获取二维码扫码状态,0 为二维码过期，1 为等待扫码，2 为待确认，4 为授权登录成功（4 状态码下会返回 token）
        let scannedNotified = false; // 避免重复提示扫码成功，等待确认
        let loginSuccess = false;
        const intervalMs = 2000; // 轮询间隔 2s
        const timeoutMs = 2 * 60 * 1000; // 2 分钟超时
        const maxAttempts = Math.ceil(timeoutMs / intervalMs);
        for (let attempt = 0; attempt < maxAttempts && !loginSuccess; attempt++) {
            try {
                const timestrap = Date.now();
                const checkResponse = await sendRequest("/login/qr/check?key=" + key + "&timestrap=" + timestrap, "GET", { "Content-Type": "application/json" });
                const status = checkResponse.data.status;
                if (status === 1) {
                    // 等待扫码
                } else if (status === 0) {
                    // 二维码已过期
                    e.reply("二维码已过期，请重新登录。");
                    logger.info("二维码已过期，key:", key);
                    loginSuccess = true;
                } else if (status === 2) {
                    if (!scannedNotified) {
                        e.reply("扫码成功，请确认登录！");
                        scannedNotified = true;
                    }
                } else if (status === 4) {
                    // 登录成功，保存信息
                    const token = checkResponse.data.token;
                    const userid = checkResponse.data.userid;

                    const user_key = "Yz:kusign:users";
                    let users = await redis.get(user_key);
                    users = users ? JSON.parse(users) : [];
                    if (!users.includes(e.user_id)) {
                        users.push(e.user_id);
                        await redis.set(user_key, JSON.stringify(users));
                    }

                    const redis_key = `Yz:kusign:userinfo:${e.user_id}`;
                    let existingInfoRaw = await redis.get(redis_key);
                    let existingInfo = existingInfoRaw ? JSON.parse(existingInfoRaw) : null;
                    const auto_sign = (existingInfo && typeof existingInfo.auto_sign !== 'undefined') ? existingInfo.auto_sign : false;
                    const userInfo = { userid: userid, token: token, token_time: Date.now(), auto_sign: auto_sign };
                    await redis.set(redis_key, JSON.stringify(userInfo));
                    e.reply("登录成功！");
                    loginSuccess = true;
                } else {
                    e.reply("登录出错，请稍后再试！");
                    logger.warn("登录出错，响应数据:", checkResponse);
                    loginSuccess = true;
                }
            } catch (error) {
                logger.error("检查登录状态失败:", error);
                loginSuccess = true;
            }

            if (!loginSuccess && attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        if (!loginSuccess) {
            e.reply("登录超时，请重试。");
            logger.info("二维码登录超时，key:", key);
        }

        //停止API服务
        try {
            await stopApiService();
        } catch (error) {
            e.reply("停止API服务失败");
            logger.error("停止API服务失败:", error);
        }
    }
}