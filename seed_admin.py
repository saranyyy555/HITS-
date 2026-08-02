"""
Run once to create the first Admin account:
    python seed_admin.py
"""
from backend.core.database import SessionLocal, Base, engine
from backend.core.security import hash_password
from backend.models.models import User, RoleEnum

Base.metadata.create_all(bind=engine)
db = SessionLocal()

EMAIL = "admin@hits.edu"
PASSWORD = "admin123"  # change this immediately after first login

if not db.query(User).filter(User.email == EMAIL).first():
    admin = User(email=EMAIL, hashed_password=hash_password(PASSWORD), role=RoleEnum.ADMIN)
    db.add(admin)
    db.commit()
    print(f"Admin created -> email: {EMAIL} | password: {PASSWORD}")
else:
    print("Admin already exists.")

db.close()
