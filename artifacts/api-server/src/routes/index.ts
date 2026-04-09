import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailsRouter from "./emails";
import uploadRouter from "./upload";
import extractRouter from "./extract";
import quotationsRouter from "./quotations";
import analyticsRouter from "./analytics";
import webhookRouter from "./webhook";
import mailRouter from "./mail";
import smtpRouter from "./smtp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailsRouter);
router.use(uploadRouter);
router.use(extractRouter);
router.use(quotationsRouter);
router.use(analyticsRouter);
router.use(webhookRouter);
router.use(mailRouter);
router.use(smtpRouter);

export default router;
