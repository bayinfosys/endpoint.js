# endpoint.js

Simple `APIEndpoint` class in javascript to encapsulate API calls and allow:

+ data to be formatted into HTML templates with [mustache.js](https://github.com/janl/mustache.js/).
+ callbacks to be triggered after the API call.
+ per-call overrides for endpoints with variable paths.


## POST Example

`POST` data to an endpoint requires an `APIEndpoint` object and
a `HTML` `form` element to collect the data for sending.

In your HTML code define the `APIEndpoint` object:

```javascript
<script type="text/javascript" src="https://cdn.jsdelivr.net/gh/bayinfosys/endpoint.js/src/endpoint.js"></script>

<script type="text/javascript">
post_form = new APIEndpoint({
  host: "http://api.com/",
  endpoint: "/hello",
  method: "POST"
});
</script>
```

and define a form in your `HTML` section:

```HTML
<form onsubmit="post_form.onSubmit(event);">
  <input type="text" name="field_1" value="hello" />
  <input type="text" name="field_2" value="world" />
  <input type="submit" />
</form>
```

when the `submit` button is clicked, the `post_form.onSubmit` function will
create the JSON object `{"field_a": "hello", "field_b": "world"}` from the 
form fields and values and send it to the endpoint.


## GET Example

`GET` requests do not require any data, so we can just call the endpoint.

```javascript
<script type="text/javascript" src="https://cdn.jsdelivr.net/gh/bayinfosys/endpoint.js/src/endpoint.js"></script>

<script type="text/javascript">
api_get = new APIEndpoint({
  host: "http://api.com/",
  endpoint: "/hello",
  method: "GET",
  container: "get-response-div",
  template: "get-response-template"
});
</script>
```

In our `HTML` we now define the container (a `div` or other element which will
contain the response data in the DOM) and a mustache template to format the
response.

This endpoint returns a JSON object like `{"name": "my-name", "location": "home"}`

```HTML
<div id="get-response-div">
</div>

<script id="get-response-template" type="x-tmpl-mustache">
  <b>{{ name }}</b> is at <em>{{ location }}</em>.
</script>
```

After calling the endpoint object with:

```javascript
api_get.call();
```

(and assuming the endpoint is functioning...) the response will be formatted
according to the template, and added to `get-response-div` contents.

`get-response-div` will now look like:

```HTML
<div id="get-response-div">
<b>my-name</b> is at <em>home</em>.
</div>
```

## Example Implementation

See `./examples` for a simple user management API with interfaces
in basic HTML and [semantic UI](https://semantic-ui.com/).
