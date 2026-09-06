import { Employee } from "@/backend/models/Employee";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Employee).collection;
