from routes import users

print(f'Users Router has {len(users.router.routes)} routes:')
for route in users.router.routes:
    methods = list(route.methods)
    print(f'  {methods[0]} {route.path}')

