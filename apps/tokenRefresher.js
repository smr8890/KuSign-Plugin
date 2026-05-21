import { Config } from "../components/index.js";

export class TokenRefresher extends plugin {
    constructor() {
        super({
            name: "Token刷新",
            event: "message",
            priority: 10
        })

        this.task = {
            cron: Config.getcfg.token_refresh_time,
            name: "KuSign Token刷新任务",
            fnc: () => this.refreshToken()
        }
    }

    async refreshToken() {

    }
}