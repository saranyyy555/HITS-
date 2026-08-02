"""
Pydantic schemas — define the shape of API request/response bodies.
"""
from pydantic import BaseModel, EmailStr
from backend.models.models import RoleEnum


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum


class DepartmentOut(BaseModel):
    id: int
    name: str
    full_name: str

    class Config:
        from_attributes = True


class SectionOut(BaseModel):
    id: int
    name: str
    department_id: int

    class Config:
        from_attributes = True
