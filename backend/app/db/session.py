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
    # Ensure all models are loaded
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Dynamic, safe column migrations for both PostgreSQL & SQLite
        def _run_migrations(sync_conn):
            from sqlalchemy import inspect, text
            inspector = inspect(sync_conn)
            is_postgres = sync_conn.dialect.name == "postgresql"
            existing_tables = set(inspector.get_table_names())

            columns_to_ensure = [
                # questions
                ("questions", "actual_difficulty", "DOUBLE PRECISION", "FLOAT"),
                ("questions", "discrimination_index", "DOUBLE PRECISION", "FLOAT"),
                ("questions", "lesson_id", "UUID", "CHAR(32)"),
                ("questions", "learning_objective_id", "UUID", "CHAR(32)"),
                # question_essays
                ("question_essays", "rubric_id", "UUID", "CHAR(32)"),
                # question_codings
                ("question_codings", "starter_code", "TEXT", "TEXT"),
                ("question_codings", "test_cases", "JSON", "JSON"),
                # exams
                ("exams", "allow_review", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("exams", "show_score", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("exams", "show_responses", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("exams", "show_correct_answers", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("exams", "show_explanations", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("exams", "show_feedback", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                # assignments
                ("assignments", "session_id", "UUID", "CHAR(32)"),
                ("assignments", "assignment_type", "VARCHAR(20) DEFAULT 'assignment'", "VARCHAR(20) DEFAULT 'assignment'"),
                ("assignments", "allow_review", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_score", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_responses", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_correct_answers", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_explanations", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_feedback", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_correct_answer", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                ("assignments", "show_explanation", "BOOLEAN DEFAULT TRUE", "BOOLEAN DEFAULT 1"),
                # classes
                ("classes", "expected_start_date", "DATE", "DATE"),
                ("classes", "expected_end_date", "DATE", "DATE"),
                ("classes", "max_students", "INTEGER", "INTEGER"),
                ("classes", "description", "TEXT", "TEXT"),
                # exam_attempts
                ("exam_attempts", "question_snapshot", "JSON", "JSON"),
                ("exam_attempts", "is_passed", "BOOLEAN", "BOOLEAN"),
                ("exam_attempts", "attempt_number", "INTEGER DEFAULT 1", "INTEGER DEFAULT 1"),
                # student_responses
                ("student_responses", "code_response", "TEXT", "TEXT"),
                ("student_responses", "feedback", "TEXT", "TEXT"),
            ]

            table_columns = {}
            for table_name in existing_tables:
                table_columns[table_name] = {c["name"] for c in inspector.get_columns(table_name)}

            for table_name, col_name, pg_def, sqlite_def in columns_to_ensure:
                if table_name not in existing_tables:
                    continue
                if col_name in table_columns.get(table_name, set()):
                    continue

                col_def = pg_def if is_postgres else sqlite_def
                if is_postgres:
                    stmt = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                else:
                    stmt = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"

                try:
                    with sync_conn.begin_nested():
                        sync_conn.execute(text(stmt))
                        table_columns[table_name].add(col_name)
                except Exception:
                    pass

        await conn.run_sync(_run_migrations)

    # Seed default roles and admin/teacher/student users

    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import select
            from app.models.user import Role, User, UserRole
            from app.core.security import hash_password

            # 1. Seed Roles
            roles_map = {}
            for r_name, r_desc in [
                ("admin", "Quản trị viên hệ thống"),
                ("teacher", "Giáo viên / Giảng viên"),
                ("student", "Học sinh / Sinh viên"),
            ]:
                stmt = select(Role).where(Role.name == r_name)
                res = await session.execute(stmt)
                role = res.scalar_one_or_none()
                if not role:
                    role = Role(name=r_name, description=r_desc)
                    session.add(role)
                    await session.flush()
                roles_map[r_name] = role

            # 2. Seed Demo Users
            demo_users = [
                ("admin@qbank.vn", "Admin@123", "Quản trị viên Hệ thống", ["admin", "teacher", "student"]),
                ("teacher@qbank.vn", "Teacher@123", "Thầy Nguyễn Văn A", ["teacher", "student"]),
                ("student@qbank.vn", "Student@123", "Học sinh Trần Văn B", ["student", "teacher"]),
                ("student1@edumate.vn", "Student@123", "Học viên Nguyễn Văn An", ["student", "teacher"]),
                ("student2@edumate.vn", "Student@123", "Học viên Trần Thị Bình", ["student", "teacher"]),
                ("student3@edumate.vn", "Student@123", "Học viên Lê Hoàng Cường", ["student", "teacher"]),
            ]
            for email, raw_pwd, full_name, user_role_names in demo_users:
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
                else:
                    # Update password and status to guarantee active login
                    user.password_hash = hash_password(raw_pwd)
                    user.status = "active"

                # Check existing roles directly from user_roles
                ur_stmt = select(UserRole.role_id).where(UserRole.user_id == user.id)
                ur_res = await session.execute(ur_stmt)
                existing_role_ids = set(ur_res.scalars().all())

                for r_name in user_role_names:
                    if r_name in roles_map and roles_map[r_name].id not in existing_role_ids:
                        session.add(UserRole(user_id=user.id, role_id=roles_map[r_name].id))
                        existing_role_ids.add(roles_map[r_name].id)

            await session.commit()

            # 3. Ensure ALL existing users have both teacher and student roles for seamless role switching
            users_stmt = select(User.id)
            users_res = await session.execute(users_stmt)
            for uid in users_res.scalars().all():
                ur_stmt = select(UserRole.role_id).where(UserRole.user_id == uid)
                ur_res = await session.execute(ur_stmt)
                current_rids = set(ur_res.scalars().all())
                for r_key in ["teacher", "student"]:
                    if r_key in roles_map and roles_map[r_key].id not in current_rids:
                        session.add(UserRole(user_id=uid, role_id=roles_map[r_key].id))
                        current_rids.add(roles_map[r_key].id)

            await session.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error seeding demo users/roles: {e}", exc_info=True)
            await session.rollback()

