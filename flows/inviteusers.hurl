POST {{URL}}login
[Form]
username: admin1@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Miguel",
    "last_name": "Figueroa",
    "role": "instructor",
    "email": "miguel@example.com"
}
HTTP 201
[Captures]
invite_token_1: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Rubén",
    "last_name": "Garza",
    "role": "instructor",
    "email": "ruben@example.com"
}
HTTP 201
[Captures]
invite_token_2: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "María",
    "last_name": "Garza",
    "role": "instructor",
    "email": "maria@example.com"
}
HTTP 201
[Captures]
invite_token_3: jsonpath "$.invite_token"

GET {{URL}}users?role=instructor
Authorization: Bearer {{token}}
HTTP 200

GET {{URL}}users?role=instructor&active=False
Authorization: Bearer {{token}}
HTTP 200

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Gerardo",
    "last_name": "Sánchez",
    "role": "student",
    "email": "gerardo@example.com"
}
HTTP 201
[Captures]
invite_token_4: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Sandra",
    "last_name": "Sánchez",
    "role": "student",
    "email": "sandra@example.com"
}
HTTP 201
[Captures]
invite_token_5: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Sebastian",
    "last_name": "Flores",
    "role": "student",
    "email": "sebas@example.com"
}
HTTP 201
[Captures]
invite_token_6: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Andrés",
    "last_name": "García",
    "role": "student",
    "email": "andresg@example.com"
}
HTTP 201
[Captures]
invite_token_7: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Carolina",
    "last_name": "Luque",
    "role": "student",
    "email": "caroluq@example.com"
}
HTTP 201
[Captures]
invite_token_8: jsonpath "$.invite_token"

POST {{URL}}users/invite
Authorization: Bearer {{token}}
{
    "first_name": "Mario",
    "last_name": "Sánchez",
    "role": "student",
    "email": "mario@example.com"
}
HTTP 201
[Captures]
invite_token_9: jsonpath "$.invite_token"

GET {{URL}}users?role=student
Authorization: Bearer {{token}}
HTTP 200

GET {{URL}}users?role=student&active=False
Authorization: Bearer {{token}}
HTTP 200

GET {{URL}}invites
Authorization: Bearer {{invite_token_1}}
HTTP 200

POST {{URL}}invites
Authorization: Bearer {{invite_token_1}}
{
  "email": "miguel@example.com",
  "password": "password123"
}
HTTP 200
[Captures]
user_id: jsonpath "$.id"

POST {{URL}}login
[Options]
output: -
[Form]
username: miguel@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"

GET {{URL}}invites
Authorization: Bearer {{invite_token_4}}
HTTP 200

POST {{URL}}invites
Authorization: Bearer {{invite_token_4}}
{
  "email": "miguel@example.com",
  "password": "password123"
}
HTTP 401

POST {{URL}}invites
Authorization: Bearer {{invite_token_4}}
{
  "email": "gerardo@example.com",
  "password": "password123"
}
HTTP 200
[Captures]
user_id: jsonpath "$.id"

POST {{URL}}login
[Options]
output: -
[Form]
username: gerardo@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"

PATCH {{URL}}users/{{user_id}}
Authorization: Bearer {{token}}
{
    "first_name": "Gerardo",
    "last_name": "Sánchez",
    "phone": "55-5555-5555",
    "special_conditions": "Fractura de rodilla hace 6 meses"
}
HTTP 200
[Captures]
user_id: jsonpath "$.id"

GET {{URL}}invites
Authorization: Bearer {{invite_token_5}}
HTTP 200

POST {{URL}}invites
Authorization: Bearer {{invite_token_5}}
{
  "email": "sandra@example.com",
  "password": "password123"
}
HTTP 200
[Captures]
user_id: jsonpath "$.id"

POST {{URL}}login
[Form]
username: admin1@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"

GET {{URL}}users?role=instructor
Authorization: Bearer {{token}}
HTTP 200

GET {{URL}}users?role=student
Authorization: Bearer {{token}}
HTTP 200