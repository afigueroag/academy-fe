POST {{URL}}register
[Options]
output: -
{
  "academy_name": "My School",
  "academy_type": "school",
  "email": "admin2@example.com",
  "first_name": "Administrador",
  "last_name": "Prueba",
  "password": "password123"
}
HTTP 201

POST {{URL}}login
[Options]
output: -
[Form]
username: admin2@example.com
password: password123
HTTP 200
[Captures]
token: jsonpath "$.access_token"