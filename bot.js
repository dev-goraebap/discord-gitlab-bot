import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

// Discord 클라이언트 생성
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// 봇 로그인 성공 시
client.once('clientReady', () => {
    console.log(`✅ 봇 로그인 성공: ${client.user.tag}`);
});

// 봇 로그인
client.login(process.env.DISCORD_BOT_TOKEN)
    .catch(error => {
        console.error('❌ 봇 로그인 실패:', error);
        process.exit(1);
    });

export default client;
