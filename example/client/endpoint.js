class APIEndpoint {
  /*
   * simple class to encapsulate hitting and endpoint and adding the response to the DOM
   *
   * process:
   * + [optional] callbacks["on_init"] is called
   * + api endpoint is hit
   * + data is recieved
   * + [optional] api response is passed to callbacks["on_receive"] for reformatting
   * + data is rendered to a mustache template to a doc fragment
   * + doc fragment is appended to the container inner html
   *   + if the container.mode parameter is not "append" the container contents
   *     are replaced on each api call
   * + [optional] callback["on_done"] function is called
   */
  constructor({host, endpoint, method, process_response, container, template, error_template, callbacks} = {}) {
    /**
     * host: string, uri of the API
     * endpoint: string, path fragment of the API endpoint
     * method: GET, POST, etc
     * container: string|object, id of the DOM object to take the results
     *            object: {id: DOM object id, mode: (append|rewrite) whether the inner html should be appended to or overwritten on new data}
     * template: string, id of the mustache template to render with endpoint data
     * error_template: optional string, id of the mustache template for error messages
     * callbacks: functions to call after various events in the endpoint invocation lifecycle
     *           + on_init: after the initial call
     *           + on_recieve: after the response from the endpoint (this function accepts
     *                         the response and may return a modified form of the response
     *                         for mutation to match the template)
     *           + on_done: after the template has been formated and inserted into the DOM
     *
     *
     *
     * callback notes:
     * + callbacks cannot be another endpoint.call method (needs a closure?)
     * + on_done is called once for every array in the output (if an array)
     *

     * process_response: function to call with the api response before passing to templating
     *                   this allows reformatting of the response for the template
     *                   must return json

     * call() and onSubmit() methods take an optional `override` object which allows
     * local overrides for containers and templates allowing parameterised response handling
     */
    this.host = host;
    this.endpoint = endpoint;
    this.method = method;
    this.process_response = process_response;
    this.template = template;
    this.error_template = error_template;
    this.callbacks = callbacks || {};

    // container can be an object with keys or a single string
    if (!container) {
      console.warn("container reference none for '" + host + "/" + endpoint + "' [" + method + "]")
      return;
    } else {
      if (typeof container === 'object') {
        this.container = container;
      } else {
        this.container = {
          id: container,  // FIXME: we are assuming it is a string
          mode: "append"
        }
      }
    }
  }

  _chk_clbks() {
    // check all defined callbacks are functions
    // TODO
    return true;
  }

  _clbk(name) {
    // common callback access point
    return (this.callbacks && this.callbacks[name]) ? this.callbacks[name] : null;
  }

  async api_call({data = null, override = null} = {}) {
    /*
     * call the api endpoint
     *
     * this method is responsible for the actual API call and
     * returning the data or raising an exception.
     *
     * override is an optional object which can provide a different
     * endpoint for e.g. when path variables are used
     */
    // NB: endpoint must start with the backslash
    const uri = [
        this.host,
        (override && override.endpoint) ? override.endpoint : this.endpoint
    ].join("");

    // console.log(uri);

    // FIXME: make call_params a callable
    var call_params = {
      method: this.method,
      mode: "cors",
      headers: {"content-type": "application/json"},
    }

    if (data) {
      call_params.body = JSON.stringify(data);
    }

    if (((this.method == "PUT") || (this.method == "POST") || (this.method == "PATCH")) && (!data)) {
      console.warn(this.method + " to '" + uri + "' with no data");
      throw {
        name: "no data",
        message: "no data passed to a data endpoint",
        detail: {uri: uri, parameters: call_params}
      }
    } else if ((this.method == "GET") && (data)) {
      console.warn(this.method + " to '" + uri + "' with data");
      throw {
        name: "unexpected data",
        message: "GET requests should not have a body",
        detail: {uri: uri, parameters: call_params}
      }
    }

    let r;
    try {
      r = await fetch(uri, call_params);
    } catch (e) {
      throw {
        name: "connection error",
        message: "unable to call '" + uri + "'",
        detail: {uri: uri}
      }
    }

    try {
      return await r.json();
    } catch (e) {
      throw {
        name: "parse error",
        message: "unable to parse response from '" + uri + "'",
        detail: {
          uri: uri,
          params: call_params
        }
      }
    }
  }

  /*
   * TEMPLATES
   */
  append_template(template_id, container, data) {
    /**
     * apply the data to the template and add to DOM
     * NB: container must be an object {id: DOM element id, mode: (append|rewrite)}
     */
    if (!template_id) {
      console.error(this.host, this.endpoint, "template_id undefined");
      return;
    }

    const template_element = document.getElementById(template_id);

    if (!template_element) {
      console.error(this.host, this.endpoint, "could not find '" + template_id + "'");
      return;
    }

    const template = template_element.innerHTML;
    const rendered = Mustache.render(template, data);

    if (!container.id) {
      console.error(this.host, this.endpoint, "container.id undefined");
      return;
    }

    const container_element = document.getElementById(container.id);

    if (!container_element) {
      console.error(this.host, this.endpoint, "could not find '" + container.id + "'");
      return;
    }

    container_element.innerHTML += rendered;
  }
/*
  apply_template(data) {
    this.append_template(this.template, this.container, data);
  }
*/
  apply_error_template(data) {
    this.append_template(this.error_template, this.container, data);
  }

  /**
   * invocation
   */
  async call({submission, override} = {}) {
    /*
     * call the endpoint with some data
     * submission can be null for HEAD/GET/etc requests
     * override object can allow different:
     *   + container id
     *   + error id
     * for this specific call
     */
    // console.log("call", this.host, this.endpoint, submission, override);

    if (this._clbk("on_init")) {
      this._clbk("on_init")(this);
    }

    // FIXME: if the endpoint does not return a list we have error
    this.api_call({data: submission, override: override})
      .then((data) => {
        return (this._clbk("on_recieve")) ? this._clbk("on_receive")(data) : data;
      })
      .then((data) => {
        // get the container for rendered template output
        let container;

        // override container spec if provided
        if (override && override.container && override.container.id) {
          container = {...this.container, ...override.container};
        } else if (this.container && this.container.id) {
          container = this.container;
        } else {
          container = null;
        }

        // FIXME: here, the mode could be "restart" and we recreate
        //        the container from a template. this would allow the
        //        container to have headers/counts/etc
        if (container) {
          if (container.mode != "append") {
            const container_el = document.getElementById(container.id);

            if (!container_el) {
              console.error(this.host, this.endpoint, "could not find '" + container.id + "'");
            } else {
              container_el.innerHTML = "";
            }
          }

          // apply the template
          if (Array.isArray(data)) {
            data.forEach((x) => this.append_template(this.template, container, x))
          } else {
            this.append_template(this.template, container, data);
          }
        } else {
          console.warn(this.host, this.endpoint, " container not specified");
        }

        // run the callback on the response data
        let on_done_fn;
        if (override && override.callbacks && override.callbacks["on_done"]) {
          on_done_fn = override.callbacks["on_done"];
        } else {
          on_done_fn = this._clbk("on_done");
        }

        if (on_done_fn) {
          if (Array.isArray(data)) {
            data.forEach((x) => on_done_fn(x));
          } else {
            on_done_fn(data);
          }
        }
      })
      .catch(error => {
         // FIXME: allow override of error templating
         console.error(error);

         if (this.error_template) {
           this.apply_error_template({summary: error.name, detail: error.message});
         }
      });
  }

  async onSubmit(e, override) {
    // default form submission handler
    e.preventDefault();

    const form_elements = Array.from(e.target.elements);
    let submission = {};

    if (!form_elements.some(el => el.type !== "submit")) {
      submission = null;
    } else {
      form_elements.forEach((el, i) => {
        if (el.type == "submit") { return; }

        if (!el.name) {
          console.error(`form element ${i} [${el.type}] has no 'name' attribute`);
          return;
        }

        submission[el.name] = el.value;
      });
    }

    this.call({submission: submission, override: override});
  }
}


exports = [APIEndpoint]
