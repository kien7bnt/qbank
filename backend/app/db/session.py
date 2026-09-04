from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Normalize database URL for Async SQLAlchemy (Render / Heroku / Postgres)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# SQLite doesn't support pool settings, so only apply them for PostgreSQL
engine_kwargs = {
    "echo": settings.DEBUG,
}

if "sqlite" not in db_url:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    })

engine = create_async_engine(
    db_url,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables and seed initial roles & demo accounts if database is empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Safe column migrations for SQLite / Postgres
        migration_statements = [
            "ALTER TABLE questions ADD COLUMN actual_difficulty FLOAT",
            "ALTER TABLE questions ADD COLUMN discrimination_index FLOAT",
            "ALTER TABLE questions ADD COLUMN lesson_id CHAR(32) REFERENCES lessons(id) ON DELETE SET NULL",
            "ALTER TABLE questions ADD COLUMN learning_objective_id CHAR(32) REFERENCES learning_objectives(id) ON DELETE SET NULL",
            "ALTER TABLE question_essays ADD COLUMN rubric_id CHAR(32) REFERENCES rubrics(id) ON DELETE SET NULL",
            "ALTER TABLE exams ADD COLUMN allow_review BOOLEAN DEFAULT 1",
            "ALTER TABLE exams ADD COLUMN show_score BOOLEAN DEFAULT 1",
            "ALTER TABLE exams ADD COLUMN show_responses BOOLEAN DEFAULT 1",
            "ALTER TABLE exams ADD COLUMN show_correct_answers BOOLEAN DEFAULT 1",
            "ALTER TABLE exams ADD COLUMN show_explanations BOOLEAN DEFAULT 1",
            "ALTER TABLE exams ADD COLUMN show_feedback BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN allow_review BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_score BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_responses BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_correct_answers BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_explanations BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_feedback BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN session_id CHAR(32) REFERENCES class_sessions(id) ON DELETE SET NULL",
            "ALTER TABLE assignments ADD COLUMN assignment_type VARCHAR(20) DEFAULT 'assignment'",
            "ALTER TABLE assignments ADD COLUMN show_correct_answer BOOLEAN DEFAULT 1",
            "ALTER TABLE assignments ADD COLUMN show_explanation BOOLEAN DEFAULT 1",
        ]
        from sqlalchemy import text
        for stmt in migration_statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists

    # Seed default roles and admin/teacher/student users

    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import select
            from app.models.user import Role, User, UserRole
            from app.core.security import hash_password

            # 1. Seed Roles
            roles_map = {}
            for r_id, r_name, r_desc in [
                (1, "admin", "Quản trị viên hệ thống"),
                (2, "teacher", "Giáo viên / Giảng viên"),
                (3, "student", "Học sinh / Sinh viên"),
            ]:
                role = await session.get(Role, r_id)
                if not role:
                    role = Role(id=r_id, name=r_name, description=r_desc)
                    session.add(role)
                    await session.flush()
                roles_map[r_name] = role

            # 2. Seed Demo Users
            demo_users = [
                ("admin@qbank.vn", "Admin@123", "Quản trị viên Hệ thống", "admin"),
                ("teacher@qbank.vn", "Teacher@123", "Thầy Nguyễn Văn A", "teacher"),
                ("student@qbank.vn", "Student@123", "Học sinh Trần Văn B", "student"),
            ]
            for email, raw_pwd, full_name, role_name in demo_users:
                stmt = select(User).where(User.email == email)
                res = await session.execute(stmt)
                user = res.scalar_one_or_none()
                if not user:
                    user = User(
                        email=email,
                        full_name=full_name,
                        password_hash=hash_password(raw_pwd),
                        status="active",
                    )
                    session.add(user)
                    await session.flush()
                    if role_name in roles_map:
                        user_role = UserRole(user_id=user.id, role_id=roles_map[role_name].id)
                        session.add(user_role)

            await session.commit()
        except Exception:
            await session.rollback()

