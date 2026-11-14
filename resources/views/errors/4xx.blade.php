@extends('errors::minimal')

@section('title', $exception->getStatusCode())
@section('code', $exception->getStatusCode())
@section('message', 'Error')
