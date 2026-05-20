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
            e.reply("启动API服务失败，请查看日志！");
            logger.error("启动API服务失败:", error);
            return;
        }
        //1. 调用二维码key接口获取key，/login/qr/key,返回qrcode，qrcode_img
        const keyResponse = await sendRequest("/login/qr/key", "GET", { "Content-Type": "application/json" });
        console.log(keyResponse)
        const key = keyResponse.data.qrcode;
        const qrcode_img = keyResponse.data.qrcode_img;
        const base64 = qrcode_img.includes(",") ? qrcode_img.split(",")[1] : qrcode_img;
        const qrImage = `base64://${base64}`;

        //发送二维码图片给用户扫码
        e.reply("请扫码登录：");
        e.reply(segment.image(qrImage));

        //3. 轮询登录状态接口，/login/qr/check，必选参数：key: ,由第一个接口生成，
        // 轮询此接口可获取二维码扫码状态,0 为二维码过期，1 为等待扫码，2 为待确认，4 为授权登录成功（4 状态码下会返回 token）
        const checkLoginStatus = async () => {
            try {
                const checkResponse = await sendRequest("/login/qr/check?key=" + key, "GET", { "Content-Type": "application/json" });
                const code = checkResponse.code;
                if (code === 0) {
                    e.reply("二维码已过期，请重新登录！");
                    clearInterval(checkInterval);
                } else if (code === 1) {
                    //等待扫码
                } else if (code === 2) {
                    e.reply("扫码成功，请确认登录！");
                } else if (code === 4) {
                    e.reply("登录成功！");
                    clearInterval(checkInterval);
                    //在这里可以处理登录成功后的逻辑，例如保存 token 等
                    const token = checkResponse.token;
                    console.log("登录成功，token:", token);
                } else {
                    e.reply("登录状态未知，请查看日志！");
                    logger.warn("未知登录状态:", checkResponse);
                }
            } catch (error) {
                logger.error("检查登录状态失败:", error);
            }
        };
        const checkInterval = setInterval(checkLoginStatus, 2000);
    }
}