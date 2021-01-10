const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { Op } = require("sequelize");
const { getProfile } = require("./middleware/getProfile");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

app.use(getProfile);

/**
 * FIX ME!
 * @returns contract by id
 */
app.get("/contracts/:id", async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: {
      id,
      [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
    },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});

/**
 * @returns a list of contracts belonging to a user
 */
app.get("/contracts", async (req, res) => {
  const { Contract } = req.app.get("models");
  const contracts = await Contract.findAll({
    where: {
      status: { [Op.ne]: "terminated" },
      [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
    },
  });
  if (!contracts) return res.status(404).end();
  res.json(contracts);
});

/**
 * @returns all unpaid jobs for a user
 */
app.get("/jobs/unpaid", async (req, res) => {
  const { Contract, Job } = req.app.get("models");
  const contracts = await Contract.findAll({
    where: {
      status: { [Op.ne]: "terminated" },
      [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
    },
  });
  if (!contracts) return res.status(404).end();
  const jobs = [];
  for (c of contracts) {
    console.log("c: ", c.toJSON());
    jobs.push(
      ...(await Job.findAll({
        where: {
          ContractId: c.id,
          paid: null,
        },
      }))
    );
  }
  res.json(jobs);
});

/**
 * Pay for a job
 */
app.post("/jobs/:job_id/pay", async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");
  const { job_id } = req.params;
  const job = await Job.findOne({ where: { id: job_id } });
  if (!job) return res.status(404).end();
  if (job.paid)
    return res.json({
      error: `already paid, payment date: ${job.paymentDate}`,
    });
  const c = await Contract.findOne({ where: { id: job.ContractId } });

  if (req.profile.id !== c.ClientId)
    return res.status(401).json({ error: "only client can pay" }).end();

  if (req.profile.balance >= job.price) {
    const amount = req.profile.balance - job.price;
    await Profile.update(
      { balance: amount },
      { where: { id: req.profile.id } }
    );
    let contractor = await Profile.findOne({ where: { id: c.ContractorId } });
    await Profile.update(
      { balance: contractor.balance + job.price },
      { where: { id: contractor.id } }
    );
    job.update({ paid: true, paymentDate: new Date() });
  }

  contractor = await Profile.findOne({ where: { id: c.ContractorId } });
  res.json();
});

/**
 * Deposits money into the the balance of a client
 */
// XXX should I get the deposit amount from request body? (not stated in the task)
app.post("/balances/deposit/:userId", async (req, res) => {
  const { Profile } = req.app.get("models");
  const { userId } = req.params;
  const user = await Profile.findOne({ where: { id: userId } });
  console.log("user: ", user.toJSON());
});

module.exports = app;
