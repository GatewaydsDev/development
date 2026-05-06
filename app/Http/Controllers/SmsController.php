<?php

namespace App\Http\Controllers;

use App\Services\TwilioSmsService;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function send(Request $request, TwilioSmsService $sms)
    {
        $data = $request->validate([
            'phone' => ['required', 'string'],
            'message' => ['required', 'string', 'max:500'],
        ]);

        $sms->send($data['phone'], $data['message']);

        return back()->with('success', 'SMS sent successfully.');
    }
}
