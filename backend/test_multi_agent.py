import asyncio
import uuid
import traceback
from app.db.session import AsyncSessionLocal
from app.api.v1.ai import run_multi_agent_pipeline, MultiAgentGenerateReq
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        res = await db.execute(select(User).limit(1))
        user = res.scalar_one()
        req = MultiAgentGenerateReq(
            prompt='Tao cau hoi ve tich phan',
            bloom_level='apply',
            expected_difficulty='medium',
            question_type='mcq',
            auto_save=False
        )
        try:
            res = await run_multi_agent_pipeline(req, db, user)
            print("PIPELINE RESULT:")
            print("Traces:", len(res["traces"]))
            for t in res["traces"]:
                print(f" - [{t['agent']}] {t['role']} ({t['time_ms']}ms): {t['output_summary']}")
            print("Quality score:", res["quality_score"])
            print("Question stem:", res["question"]["stem"])
            print("Options count:", len(res["question"]["options"]))
        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
