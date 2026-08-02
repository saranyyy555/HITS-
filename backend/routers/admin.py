from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.deps import require_role
from backend.core.security import hash_password
from backend.models.models import User, Department, Section
from backend.schemas.schemas import UserCreate, UserOut, DepartmentOut, SectionOut

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role("ADMIN"))],  # every route below requires ADMIN role
)


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()


@router.post("/departments", response_model=DepartmentOut)
def create_department(name: str, full_name: str, db: Session = Depends(get_db)):
    dept = Department(name=name, full_name=full_name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/sections", response_model=list[SectionOut])
def list_sections(db: Session = Depends(get_db)):
    return db.query(Section).all()
