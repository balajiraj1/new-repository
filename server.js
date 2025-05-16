const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());
const multer = require('multer');
const path = require('path');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to the uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with timestamp
  },
});

// File filter to allow only JPEG and PNG images
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});
app.use('/uploads', express.static('uploads'));
// Schema are created here
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  usertype: { type: String, required:true },
  amount: { type:Number,required:true },
  dob: { type:Date,required:false },
  street: { type:String,required:false},
  district:{type:String,required:false },
  state:{type:String,required:false},
});
const GarageSchema = new mongoose.Schema({
  garage_id:{type:Number,required:true,unique:true},
  garage_name:{type:String,required:true},
  admin:{type:String,required:true},
  location:{type:String,required:true},
  address:{type:String,required:false},
  no_of_cars:{type:Number,required:true}
});
const CarSchema = new mongoose.Schema({
  car_id: { type: Number, required: true, unique: true },
  car_brand: { type: String, required: true },
  car_type: { type: String, required: true },
  rent_for_days: { type: Number, required: true },
  rent_for_months: { type: Number, required: true },
  garage_id: { type: Number, required: true },
  status: { type:String, required:true},
  admin: { type:String,required:true},
  ratings: { type:Number,required:false},
  username: { type:String,required:false},
  enddate: { type:Date,required:false}
});
const carTravelSchema = new mongoose.Schema({
  car_id: { type: Number, required:true},
  username: { type: String,required:true},
  admin: { type:String,required:true},
  startdate: { type:Date,required:true},
  enddate:{type:Date,required:true},
  amount:{type:Number,required:true},
  ratings: { type:Number, required:false}
});
carTravelSchema.index({car_id:1,username:1,startdate:1},{unique:true});
const AcceptRejectSchema = new mongoose.Schema({
  car_id: { type: Number, required:true},
  username: { type: String,required:true},
  admin: { type: String,required:true},
  date: { type:Date, required:true}
});
AcceptRejectSchema.index({car_id:1,username:1,date:1},{unique:true});

const RechargeSchema = new mongoose.Schema({
  username: { type:String,required:true},
  date:{ type:Date,required:true},
  amount:{type:Number,required:true}
});
RechargeSchema.index({username:1,date:1},{unique:true});
//models are created using the schema here
const User = mongoose.model('Users', UserSchema);
const Cars = mongoose.model('Car', CarSchema);
const AcceptReject = mongoose.model('accept_rejects',AcceptRejectSchema);
const Garages = mongoose.model('garage',GarageSchema);
const CarTravel = mongoose.model('car_travels',carTravelSchema);
const Recharge = mongoose.model('recharge',RechargeSchema);
// booking now
app.post ('/book-car',async(req,res)=>{
  const {startDate,endDate,username,car_id,admin,amount}=req.body;
  console.log(startDate,endDate,username,car_id,admin,amount);
  const existingUser = await User.findOne({  username:username });
  const adminUser = await User.findOne({username:admin});
  const balanceamount=existingUser.amount;
  const adminamount = adminUser.amount;
  if(balanceamount<amount)
  {
    console.log(balanceamount);
    return res.status(401).json({success:false,message:'insufficient amount'});
  }
  else
  {
    try
    {
      const updateresult=await User.updateOne({username:username},{$set:{amount:Number(balanceamount-amount)}});
      const updateresult2=await User.updateOne({username:admin},{$set:{amount:Number(adminamount+amount)}});
      const updateresult1=await Cars.updateOne({car_id:car_id},{$set:{status:'booked',username:username,enddate:Date(endDate)}});
      existingUser.amount=balanceamount-amount;
      console.log(updateresult);
      console.log(updateresult1);
      console.log(updateresult2);
      const newHistory = new CarTravel({
      car_id:car_id,
      username:username,
      admin:admin,
      amount:amount,
      startdate:Date(startDate),
      enddate:Date(endDate)
    });
    await newHistory.save();

    const newamount = -amount;
    const rechargehistory=new Recharge({username:username,date:new Date(),amount:newamount});
    const rechargehistory1=new Recharge({username:admin,date:new Date(),amount:amount});
    await rechargehistory.save();
    await rechargehistory1.save();
    console.log(updateresult);
    console.log(updateresult1);
    console.log(updateresult2);
    if(updateresult.modifiedCount>0 && updateresult1.modifiedCount>0 && updateresult2.modifiedCount>0)
    return res.status(200).json({success:true,message:'car booked sucessfully',user:existingUser});
    else
    return res.status(201).json({success:false,message:'not working well'});
  }
  catch(error)
  {
    return res.status(501).json({success:false,message:error.message});
  }
  }
});
// functions deals with m=backend
app.post('/cars',async(req,res)=>{ 
  const { admin,carid,username} = req.body;
  if (!carid || !username || !admin) {
    return res.status(400).json({ message: 'car_id and username are required', success: false });
  }
  try {
    // Update the car status to "booked"
    const result = await Cars.updateOne(
      { car_id: carid , status:'rent' }, // Filter by carid
      { $set: { status: 'booking'} } // Update status and add bookedBy
    );
    // Check if a document was updated
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Car not found',success:false });
    }
    else{
      const bookedAt = new Date();
      const booking = new AcceptReject({
        car_id: carid, // Match schema field
        username,
        date: bookedAt,
        admin,
      });
      await booking.save();
    // Success response
    return res.status(200).json({ message: 'Car booked successfully',success:true});
    }
  } catch (error) {
    // Log the error for debugging (optional)
    console.error('Error updating car:', error);

    // Return error response
    return res.status(500).json({ message: 'Failed to book car',success:false });
  }
});

// register
app.post('/register', async (req, res) => {
  const { email, username, password,usertype } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields are required' 
    });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    const amount = 0;
    const newUser = new User({ email, username, password,usertype,amount:amount });
    await newUser.save();

    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
});

// new garage creation is done

app.post('/newgarage', async (req, res) => {
  const { username,garage_name,location } = req.body;
  console.log(username,":username ,",garage_name,":garage name",location,":location");
  if (!username || !garage_name || !location) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields are required' 
    });
  }
  try{

    // Find the maximum _id
    const maxIdDoc = await Garages.find().sort('-garage_id').limit(1);
    console.log(maxIdDoc);
    const maxId = maxIdDoc.length > 0 ? maxIdDoc[0].garage_id : 0;
    const newGarageId = maxId + 2;
    console.log(newGarageId);
    const car_count = 0;
    // Create new garage document
    const newGarage = {
      garage_id: newGarageId,
      admin:username,
      garage_name:garage_name,
      location:location,
      no_of_cars:car_count
    };

    // Insert the new garage document
    await Garages.insertOne(newGarage);

    return res.status(201).json({
      success: true,
      message: 'Garage created successfully',
      garage: newGarage
    });   
  }
  catch(error){
    return res.status(500).json({ 
      success: false, 
      message: 'Server error: ' +" "+ error.message
    });
  }
});

// accept or reject is handling in this phase

app.post('/list', async (req, res) => {
  console.log('Received data successfully ', req.body);
  const { data, status } = req.body;
  console.log("data starts\n",data,": data", status,":status");
  if (!data || !status) {
    console.log('error occurred ', data, status);
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  try {
    if (status === 'accept') {
      const car_id  = data.car_id;
      const username = data.username;
      const admin = data.admin;
      try {
          
        console.log('Attempting to delete from AcceptReject');
        const del = await AcceptReject.deleteOne({ username, admin, car_id });
        console.log('Delete result:', del);
    
        console.log('Attempting to update Cars');
        const result = await Cars.updateOne(
          { car_id: car_id, status: 'booking' },
          { $set: { status: 'book now',username:username } }
        );
        console.log('Update result:', result);
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Car not found', success: false });
        } else if (result.matchedCount > 0 && del.deletedCount > 0) {
          return res.status(200).json({ message: 'car is ready to book successfully', success: true });
        }
      } catch (error) {
        console.error('Error in accept block:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
      }
    }
    else if (status === 'reject') {
      const { car_id, username, date, admin } = data;
      const result = await AcceptReject.deleteOne({ username, date, admin, car_id });
      const result1 = await Cars.updateOne(
        { car_id:car_id, status: 'booking' },
        { $set: { status: 'rent' } }
      );
      if (result.deletedCount > 0 && result1.modifiedCount > 0) {
            return res.status(200).json({ message: 'car booking deleted successfully', success: true });
      } else {
        return res.status(404).json({ message: 'car is not there', success: false });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// recharge amount

app.post('/recharge', async (req, res) => {
  const { username, amount, recharge } = req.body;

  // Validate input fields
  if (!username || amount === undefined || recharge === undefined) {
    return res.status(400).json({
      success: false,
      message: 'All fields (username, amount, recharge) are required',
    });
  }

  // Validate numeric inputs
  const parsedAmount = Number(amount);
  const parsedRecharge = Number(recharge);
  if (isNaN(parsedAmount) || isNaN(parsedRecharge) || parsedRecharge <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount and recharge must be valid positive numbers',
    });
  }

  try {
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate current amount matches
    if (user.amount !== parsedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Current amount mismatch',
      });
    }

    // Calculate total amount
    const totalAmount = parsedAmount + parsedRecharge;

    // Update user in the database
    const updateResult = await User.updateOne(
      { username },
      { $set: { amount: totalAmount } }
    );
    const rechargehistory = {
      date:new Date(),
      username:username,
      amount:parsedRecharge
    };

    // Insert the new garage document
    await Recharge.insertOne(rechargehistory);

    if (updateResult.modifiedCount > 0) {
      return res.status(200).json({
        success: true,
        message: 'Recharged successfully',
        updatedAmount: totalAmount,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'No update performed',
      });
    }
  } catch (error) {
    console.error('Recharge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
});

app.get('/recharge',async(req,res) =>{
  const username = req.query.username;
  console.log('username:',username);
  if(username!==null && username!==undefined)
  {
      try{
        const data = await Recharge.find({username:username}).sort({date:-1});
        console.log('data',data);
        return res.status(201).json({message:'retrieved successfully',success:true,data:data});
      }catch(error){
        return res.status(401).json({message:'backend error',success:false});
      }
  }
  else{
    return res.status(501).json({message:'data is not retrieved properly',success:false});
  }
});

//new cars

//login is done
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required' 
    });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password or usertype' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Login successful',
      usertype: user.usertype,
      user: user
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server error: ' +usertype+" "+ error.message
    });
  }
});

app.get('/home', async (req, res) => {
  const result1 = await Cars.find({status:'booked'});
  console.log(result1);
  try {
    const result =await Cars.updateMany(
      {
        enddate: { $lt: new Date() },
        status: 'booked'
      },
      {
        $set: { status: 'rent' },
        username: null
      }
    );
    const cars = await Cars.find({status:'rent'});
    res.json({
      cars: cars,
      message: cars.length > 0 ? 'Cars retrieved successfully' : 'No cars found'
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    res.status(500).json({
      cars: [],
      message: 'Error retrieving cars from database'
    });
  }
});

// get customer users

app.get('/users', async (req, res) => {
  try {
    const cars = await User.find({usertype:'customer'});
    res.json({
      garage: cars,
      message: cars.length > 0 ? 'Cars retrieved successfully' : 'No cars found',
      success:true
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    res.status(500).json({
      garage: [],
      message: 'Error retrieving cars from database',
      success:false
    });
  }
});
// accept or reject list is retrieval
app.get('/list', async (req, res) => {
  console.log(req);
  const { username } = req.query;
  console.log(username," :username");
  if(username==undefined)
  {
      return res.json({cars:[],message:"username is not retrieved properly"});
  }
  try {
    const cars = await AcceptReject.find({admin:username});
    res.json({
      car_user: cars,
      message: cars.length > 0 ? 'Cars retrieved successfully' : 'No cars found'
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    res.status(500).json({
      car_user: [],
      message: 'Error retrieving cars from database'
    });
  }
});

// booking list



// admin page shows the garages

app.get('/admin', async (req, res) => {
  const { username } = req.query.username ? {username:req.query.username}:null;
  if(username!=null)
  {
    try {
    const garage = await Garages.find({admin:username});
    res.json({
      garage: garage,
      message: garage.length > 0 ? 'Cars retrieved successfully' : 'No cars found',
      success:true
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    res.status(500).json({
      garage_list: [],
      message: 'Error retrieving cars from database',
      success:false
    });
  }
}
});
app.get('/garage', async (req, res) => {
  const { garage_id } = req.query.garage_id ? { garage_id:parseInt(req.query.garage_id) } : { garage_id: null };
  console.log(garage_id,": garage id");
  if (!garage_id) {
    return res.status(400).json({
      garage: [],
      message: 'Invalid or missing garage_id',
      success: false
    });
  }
  try {
    const garage = await Cars.find({garage_id:garage_id});
    res.json({
      garage: garage,
      message: garage.length > 0 ? 'Cars retrieved successfully' : 'No cars found',
      success:true
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    res.status(500).json({
      garage_list: [],
      message: 'Error retrieving cars from database',
      success:false
    });
  }
});

app.get('/booking', async (req, res) => {
  const {username}=req.query;
  console.log(username);
  try {
    const cars = await Cars.find({status:'book now',username:username});
    console.log(cars);
    return res.json({
      cars: cars,
      message: cars.length > 0 ? 'Cars retrieved successfully' : 'No cars found'
    });
  } catch (error) {
    console.error('Error retrieving cars:', error);
    return res.status(500).json({
      cars: [],
      message: 'Error retrieving cars from database'
    });
  }
});

app.post('/addcar', async (req, res) => {
  console.log('Received car data:', req.body);
  const { car_brand, car_type, rent_for_days, rent_for_months, garage_id, status, admin } = req.body;

  // Validate input fields
  if (!car_brand || !car_type || !rent_for_days || !rent_for_months || !garage_id || !status || !admin) {
    console.log('Missing fields:', { car_brand, car_type, rent_for_days, rent_for_months, garage_id, status, admin });
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
    });
  }

  try {
    // Generate new car_id
    const maxIdDoc = await Cars.find().sort('-car_id').limit(1);
    const maxId = maxIdDoc.length > 0 ? maxIdDoc[0].car_id : 0;
    const car_id = maxId + 2;
    console.log('Generated car_id:', car_id);

    // Create new car object
    const newCar = new Cars({
      car_id,
      car_brand,
      car_type,
      rent_for_days: Number(rent_for_days),
      rent_for_months: Number(rent_for_months),
      garage_id: Number(garage_id),
      status,
      admin,
    });
    await newCar.save();

    // Update garage's no_of_cars
    const garage = await Garages.findOne({ garage_id: Number(garage_id) });
    console.log('Garage found:', garage);
    if (!garage) {
      // Optionally, delete the newly created car to maintain consistency
      await Cars.deleteOne({ car_id });
      return res.status(404).json({
        success: false,
        message: 'Garage not found',
      });
    }

    const car_count = Number(garage.no_of_cars) + 1;
    console.log('New car_count:', car_count);

    const updateResult = await Garages.updateOne(
      { garage_id: Number(garage_id) },
      { $set: { no_of_cars: car_count } }
    );
    console.log('Garage update result:', updateResult);

    if (updateResult.modifiedCount === 0) {
      console.warn('Garage found but no_of_cars not updated:', garage);
    }

    res.status(201).json({
      success: true,
      message: 'Car added successfully',
      car: newCar,
    });
  } catch (error) {
    console.error('Error adding car:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
});

// remove car

app.post('/garage', async (req, res) => {
  const { car } = req.body;

  if (!car || !car.car_id || !car.garage_id) {
    return res.status(400).json({
      success: false,
      message: 'Car object with car_id and garage_id is required',
    });
  }

  try {
    // Find the car
    const existingCar = await Cars.findOne({ car_id: Number(car.car_id) });
    if (!existingCar) {
      return res.status(404).json({
        success: false,
        message: 'Car not found',
      });
    }

    // Prevent deletion of booked cars
    if (existingCar.status === 'booked' || (existingCar.enddate && existingCar.enddate > new Date())) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a booked car',
      });
    }

    // Delete related records
    await CarTravel.deleteMany({ car_id: Number(car.car_id) });
    await AcceptReject.deleteMany({ car_id: Number(car.car_id) });

    // Delete the car
    await Cars.deleteOne({ car_id: Number(car.car_id) });

    // Update garage's no_of_cars
    const garage = await Garages.findOne({ garage_id: Number(car.garage_id) });
    if (!garage) {
      return res.status(404).json({
        success: false,
        message: 'Garage not found',
      });
    }

    const newCarCount = Math.max(0, Number(garage.no_of_cars) - 1);
    await Garages.updateOne(
      { garage_id: Number(car.garage_id) },
      { $set: { no_of_cars: newCarCount } }
    );

    res.status(200).json({
      success: true,
      message: 'Car removed successfully',
    });
  } catch (error) {
    console.error('Error removing car:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
    });
  }
});

app.get('/customer-history', async (req, res) => {
  const { username } = req.query;
  console.log(username);
  try {
    const customer_history = await CarTravel.find({ username: username })
      .select('car_id startdate enddate amount ratings')
      .sort({ startdate: -1 });
    console.log(customer_history);
    return res.json({ garage: customer_history, success: true, message: 'successfully retrieved' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'backend error' });
  }
});

app.get('/car-history', async (req, res) => {
  const { car_id } = req.query;
  console.log(car_id);
  try {
    const customer_history = await CarTravel.find({ car_id: Number(car_id) })
      .select('username startdate enddate amount ratings')
      .sort({ startdate: -1 });
    console.log(customer_history);
    return res.json({ garage: customer_history, success: true, message: 'successfully retrieved' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'backend error' });
  }
});

app.post('/profile', async (req, res) => {
  const travel = req.body; // Use req.body instead of req.query for POST requests
  console.log('travel:', travel.travel,travel.travel.startdate);

  try {
    // Step 1: Update the rating in CarTravel
    const updateResult = await CarTravel.updateOne(
      {
        username: travel.travel.username,
        startdate: new Date(travel.travel.startdate), // Ensure correct date format
        enddate: new Date(travel.travel.enddate),
        car_id: travel.travel.car_id
      },
      { $set: { ratings: travel.travel.ratings } } // Update the ratings field
    );
    console.log('updated result:',updateResult);
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: 'CarTravel record not found' });
    }

    // Step 2: Calculate the average rating for the car
    const travelRatings = await CarTravel.find(
      { car_id: travel.travel.car_id, ratings: { $exists: true, $ne: null } },
      { ratings: 1 }
    );
    console.log(travelRatings);
    const ratings = travelRatings.map((travel) => travel.ratings);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0;
    console.log(averageRating);
    // Step 3: Update the averageRating in the Car schema
    const updateresult1 = await Cars.updateOne(
      { car_id: travel.travel.car_id },
      { $set: { ratings: averageRating } }
    );
    if(updateresult1.modifiedCount>0)
    return res.status(200).json({
      message: 'Rating updated successfully',
      averageRating: averageRating
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = 5001;
mongoose.connect('mongodb://localhost:27017/ds', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch(err => console.error('MongoDB connection error:', err));