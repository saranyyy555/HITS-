"""
Core database models — the tables Person B (attendance/scheduler) and
Person C (dashboards) will build against.
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, Enum, Time
)
from sqlalchemy.orm import relationship
from backend.core.database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    FACULTY = "FACULTY"
    CLASS_TEACHER = "CLASS_TEACHER"
    HOD = "HOD"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)   # e.g. "CSE", "AI&DS"
    full_name = Column(String, nullable=False)            # e.g. "Computer Science Engineering"

    sections = relationship("Section", back_populates="department")
    faculty = relationship("Faculty", back_populates="department")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                 # e.g. "A", "B"
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    class_teacher_id = Column(Integer, ForeignKey("faculty.id"), nullable=True)

    department = relationship("Department", back_populates="sections")
    class_teacher = relationship("Faculty", foreign_keys=[class_teacher_id])
    students = relationship("Student", back_populates="section")


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    department = relationship("Department", back_populates="faculty")
    user = relationship("User", back_populates="faculty_profile")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)

    section = relationship("Section", back_populates="students")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)


class Timetable(Base):
    """One row = one period slot for a section on a given weekday."""
    __tablename__ = "timetable"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    period_no = Column(Integer, nullable=False)            # 1–8
    weekday = Column(Integer, nullable=False)               # 0=Monday .. 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    section = relationship("Section")
    subject = relationship("Subject")
    faculty = relationship("Faculty")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True)

    faculty_profile = relationship("Faculty", back_populates="user", uselist=False)
