from django.contrib import admin

from haushalt.models import FolderEntry, ItemMemory, ShoppingItem, ShoppingList, ShoppingTrip, Task, TaskCompletion

for model in (ShoppingList, ShoppingItem, ItemMemory, ShoppingTrip, Task, TaskCompletion, FolderEntry):
    admin.site.register(model)
