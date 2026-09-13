import { PreBooking } from "@/backend/models/PreBooking";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(PreBooking).collection;
