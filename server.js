import express from 'express';
import client from './bot.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json());

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: '호호봇 Webhook 서버가 실행 중입니다.',
        bot: client.user ? client.user.tag : 'Not logged in'
    });
});

// 깃랩 Webhook 엔드포인트
app.post('/webhook', async (req, res) => {
    try {
        const event = req.body;

        // 이슈 생성 이벤트만 처리
        if (event.object_kind !== 'issue') {
            return res.status(200).json({message: 'Not an issue event'});
        }

        // 이슈 생성이 아닌 경우 (update, close 등) 무시
        if (event.object_attributes.action !== 'open') {
            return res.status(200).json({message: 'Not an issue creation event'});
        }

        console.log('📥 이슈 생성 이벤트 수신:', event.object_attributes.title);

        // 포럼 채널 가져오기
        const forumChannel = await client.channels.fetch(process.env.DISCORD_FORUM_CHANNEL_ID);

        if (!forumChannel || !forumChannel.isThreadOnly()) {
            throw new Error('포럼 채널을 찾을 수 없거나 포럼 채널이 아닙니다.');
        }

        // 이슈 정보 추출
        const issue = event.object_attributes;
        const repository = event.repository || event.project;
        const user = event.user;

        // 포럼 포스트 제목
        const threadTitle = `[${repository.name}] ${issue.title}`;

        // 포럼 포스트 본문
        const threadContent = `
📦 **레포**: ${repository.name}
👤 **담당**: ${user.name} (@${user.username})
${issue.labels && issue.labels.length > 0 ? `🏷️ **라벨**: ${issue.labels.map(l => l.title).join(', ')}` : ''}

${issue.description || '*(설명 없음)*'}

[🔗이슈 보기](${issue.url})
`.trim();

        // 포럼 스레드 생성
        const thread = await forumChannel.threads.create({
            name: threadTitle.slice(0, 100), // 디스코드 제목 길이 제한
            message: {
                content: threadContent
            }
        });

        console.log('✅ 포럼 포스트 생성 완료:', thread.name);

        res.status(200).json({
            message: 'Issue posted to forum successfully',
            threadId: thread.id
        });

    } catch (error) {
        console.error('❌ Webhook 처리 중 오류:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 Webhook 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
});
