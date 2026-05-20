export class Test extends plugin {
    constructor() {
        super({
            name: "测试",
            event: "message",
            priority: 1000,
            rule: [
                {
                    reg: "^#?测试$",
                    fnc: "test",
                    log: true,
                }
            ],
        })
    }

    async test(e) {
        e.reply("测试成功！")
    }
}