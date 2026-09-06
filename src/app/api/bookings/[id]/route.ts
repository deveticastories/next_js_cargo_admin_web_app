import { Booking } from "@/backend/models/Booking";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Booking).item;
