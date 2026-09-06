import { Booking } from "@/backend/models/Booking";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Booking).collection;
