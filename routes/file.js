const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const File = require('../models/file');
const { v4: uuidv4 } = require('uuid');

let storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

let upload = multer({ storage, limits: { fileSize: 1000000 * 100 } }).single(
  'myfile'
); //100mb

router
  .route('/')
  .post((req, res) => {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(500).send({ error: err.message });
      }
      const file = new File({
        filename: req.file.filename,
        uuid: uuidv4(),
        path: req.file.path,
        size: req.file.size,
      });
      const response = await file.save();
      res.json({ file: `${process.env.APP_BASE_URL}/files/${response.uuid}` });
    });
  })
  .get((req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });

router.post('/send', async (req, res) => {
  const { uuid, emailTo, emailFrom, expiresIn } = req.body;
  if (!uuid || !emailTo || !emailFrom) {
    return res
      .status(422)
      .send({ error: 'All fields are required except expiry.' });
  }
  // Get data from db
  const file = await File.findOne({ uuid: uuid });
  file.sender = emailFrom;
  file.receiver = emailTo;
  const response = await file.save();

  nodemailer.createTestAccount((err, account) => {
    if (err) {
      console.error('Failed to create a testing account. ' + err.message);
      return res.status(500).send({ error: 'Something went wrong.' });
    }

    // Create a SMTP transporter object
    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587 ,
      secure : false ,
      requireTLS : true ,
      // secure: process.env.SECURE,
      auth: {
        user : 'rahulkhandelwal9530057219@gmail.com' ,
        pass : 'nzavbziivgymbneo'
      },
    });

    // Message object
    let message = {
      from: emailFrom,
      to: emailTo,
      subject: 'inShare file sharing',
      text: `${emailFrom} shared a file with you.`,
      html: require('../services/emailTemplate')({
        emailFrom,
        downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}?source=email`,
        size: parseInt(file.size / 1000) + ' KB',
        expires: '24 hours',
      }),
    };

    transporter.sendMail(message, (err, info) => {
      if (err) {
        return res.status(500).json({ error: 'Error in email sending.' });
      }
      return res.json({ success: true });
    });

  });
});

module.exports = router;