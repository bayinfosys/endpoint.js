import os
import sys
import logging

from typing import List
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from faker import Faker


#
# logging
#
def setup_logger():
  root = logging.getLogger()

  handler = logging.StreamHandler(sys.stdout)
  handler.setLevel(os.getenv("LOG_LEVEL") or "DEBUG")
  root.addHandler(handler)

#  formatter = logging.Formatter("[%(asctime)s] %(levelname).1s %(name)s %(pathname)s:%(lineno)d %(funcName)s - %(message)s")
  formatter = logging.Formatter("[%(asctime)s] %(levelname).1s %(name)s %(funcName)s - %(message)s")

  for handler in root.handlers:
    handler.setFormatter(formatter)

  root.setLevel(os.getenv("LOG_LEVEL") or "WARNING")
  root.propagate = True

  return root



logger = setup_logger()


#
# models/db
#
class UserModel(BaseModel):
  username: str
  password: str
  lang_code: str
  full_name: str
  avatar_image: str = "https://placekitten.com/120/120"
  comments: List[str] = []


class CommentModel(BaseModel):
  username: str
  comment: str


class GetUserResponse(BaseModel):
  username: str
  full_name: str
  lang_code: str
  avatar_image: str


class GetCommentsResponse(BaseModel):
  username: str
  comments: List[str]


def create_dummy_users(cnt: int):
  """create a set of dummy users"""
  fake = Faker()
  for _ in range(cnt):
    p = fake.profile(fields=["username", "name"])
    yield UserModel(
        username=p["username"],
        password=fake.password(),
        lang_code=fake.language_code(),
        full_name=p["name"],
        comments=fake.random_elements(elements=list([fake.sentence() for _ in range(5)]))
    )


#
# API
#
app = FastAPI(
  title="User management",
  description="Dummy API to demonstrate the endpoints.js package"
)

origins = [
    "http://localhost:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_db():
  """create a dummy database in memory"""
  app.state.db = {}
  for user in create_dummy_users(3):
    app.state.db.update({user.username: user})


@app.get("/user", response_model=List[GetUserResponse])
def list_users(request: Request):
  return list(request.app.state.db.values())


@app.post("/user")
def create_user(request: Request, user: UserModel):
  request.app.state.db.update({user.username: user})


@app.get("/user/{username}", response_model=GetUserResponse)
def get_user_details(request: Request, response: Response, username: str):
  try:
    return request.app.state.db[username]
  except KeyError as e:
#    response.status_code = 404
#    return GetUserResponse(
    raise HTTPException(status_code=404, detail=f"user {username} not found.") from e


@app.delete("/user/{username}")
def delete_user(request: Request, username: str):
  request.app.state.db.pop(username)


@app.post("/comment")
def add_user_comment(request: Request, response: Response, comment: CommentModel):
  try:
    return request.app.state.db[comment.username].comments.append(comment.comment)
  except KeyError:
    response.status_code = 404


@app.get("/comment/{username}", response_model=GetCommentsResponse)
def get_user_comments(request: Request, response: Response, username: str):
  try:
    return GetCommentsResponse(
        username=username,
        comments=request.app.state.db[username].comments
    )
  except KeyError:
    response.status_code = 404
    return GetCommentsResponse(
        username=username,
        comments=[]
    )


@app.get("/status")
async def status():
  return {"status": "ok"}
