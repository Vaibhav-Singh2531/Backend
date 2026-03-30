import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens")
    }
}

const registeruser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation
    // chack if user already exist
    // check for images , check for avatar
    // upload them to cloudinary , avatar
    // create user object -  create entry in db
    // remove password and referesh token feild from the response
    // check for user creation
    // return res

    const { username, email, fullName } = req.body;

    if (fullName == "") {
        throw new ApiError(400, "fullname is required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already existed")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Somthing went wrong")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!email && !username) {
        throw new ApiError(400, "Username and email is required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!existedUser) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await existedUser.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Incorrect credentials")
    }

    const { accessToken, refreshToken } = generateAccessAndRefreshToken(existedUser._id);

    const loggedUser = await User.findById(existedUser._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loggedUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        ))
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
        },
        {
            new: true
        }

    )

    const option = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",option)
    .clearCookie("refreshToken",option)
    .json(new ApiResponse(200, {} , "User Looged Out"))
})


export { registeruser, loginUser, logoutUser } 