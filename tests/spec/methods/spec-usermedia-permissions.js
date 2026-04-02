function testUserMediaPermissions() {
  function initAirConsoleAsController() {
    spyOn(document, 'getElementsByTagName').and.callFake(function() {
      return [{ src: 'http://localhost/api/airconsole-latest.js' }];
    });
    airconsole = new AirConsole({ setup_document: false });
    airconsole.device_id = DEVICE_ID; // 2 = controller
    airconsole.devices[0] = {};
    airconsole.devices[DEVICE_ID] = { uid: 1237, nicktype: 'Sergio', location: LOCATION, custom: {} };
  }

  // Groups 1–3 need jasmine.clock() for the timeout test
  describe('promise success', function() {
    beforeEach(function() {
      jasmine.clock().install();
      initAirConsoleAsController();
    });

    afterEach(function() {
      jasmine.clock().uninstall();    // ← uninstall after ALL tests
    });

    // Group 1: Early rejections (sync, resolve immediately)

    it('Should reject with "getUserMedia is not supported on screen" when device_id === AirConsole.SCREEN', function(done) {
      airconsole.device_id = AirConsole.SCREEN;

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: getUserMedia is not supported on screen');
        done();
      });
    });

    it('Should reject with "AirConsole not ready" when device_id === undefined', function(done) {
      airconsole.device_id = undefined;

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: AirConsole not ready');
        done();
      });
    });

    it('Should reject with "AirConsole not ready" when device_id === null', function(done) {
      airconsole.device_id = null;

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: AirConsole not ready');
        done();
      });
    });

    it('Should reject with "Request already in progress" when media_permission_pending_ is already true', function(done) {
      airconsole.media_permission_pending_ = true;

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: Request already in progress');
        done();
      });
    });

    it('Should reject with "getUserMedia failed: audio or video constraint must be specified" when constraints are null', function(done) {

      airconsole.getUserMedia(null).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: audio or video constraint must be specified');
        done();
      });
    });

    it('Should reject with "getUserMedia failed: audio or video constraint must be specified" when constraints are undefined', function(done) {

      airconsole.getUserMedia(undefined).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: audio or video constraint must be specified');
        done();
      });
    });

    it('Should reject with "getUserMedia failed: audio or video constraint must be specified" when constraints are empty', function(done) {

      airconsole.getUserMedia({}).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('getUserMedia failed: audio or video constraint must be specified');
        done();
      });
    });

    it('Should set media_permission_pending_ to true when a valid request is started', function() {
      spyOn(airconsole, 'sendEvent_');

      airconsole.getUserMedia({ audio: true });

      expect(airconsole.media_permission_pending_).toBe(true);
    });

    it('Should call sendEvent_(...) with correct payload when valid', function() {
      spyOn(airconsole, 'sendEvent_');

      airconsole.getUserMedia({ audio: true });

      expect(airconsole.sendEvent_).toHaveBeenCalledWith(
        'requestUserMediaPermission',
        jasmine.objectContaining({ constraints: { audio: true } })
      );
    });

    // Group 2: resolveMediaPermission_ / event handler responses

    it('Should resolve with {success: false, reason} on userMediaPermissionDenied operation', function(done) {
      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.reason).toBe('temporary');
        done();
      });

      dispatchCustomMessageEvent({
        action: 'event',
        type: 'userMediaPermissionDenied',
        data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
      });
    });

    it('Should resolve with {success: true, stream: <stream>} on userMediaPermissionGranted when getUserMedia succeeds with audio tracks', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(true);
        expect(result.stream).toBe(fakeStream);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should resolve with {success: false, error: err} on userMediaPermissionGranted when getUserMedia rejects', function(done) {
      const testError = new Error('getUserMedia failed: Permission denied');
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(testError));

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error).toBe(testError);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should resolve with {success: true, stream: <stream>} on promptUserMediaPermission when getUserMedia succeeds with audio tracks', function(done) {

      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(true);
        expect(result.stream).toBe(fakeStream);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });
    });

    it('Should clear media_permission_pending_ after resolution', function(done) {
      spyOn(airconsole, 'sendEvent_');

      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(airconsole.media_permission_pending_).toBe(false);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should handle double-call to resolveMediaPermission_ safely (second call is no-op)', function(done) {
      spyOn(airconsole, 'sendEvent_');

      let resolveCallCount = 0;
      airconsole.getUserMedia({ audio: true }).then(function(result) {
        resolveCallCount++;
        expect(resolveCallCount).toBe(1);
        expect(result.success).toBe(false);
        expect(result.reason).toBe('temporary');

        // Now call resolveMediaPermission_ again - this should be no-op
        airconsole.resolveMediaPermission_({ success: true });

        // Immediately verify resolveCallCount is still 1
        expect(resolveCallCount).toBe(1);
        done();
      });

      dispatchCustomMessageEvent({
        action: 'event',
        type: 'userMediaPermissionDenied',
        data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
      });
    });

    // Group 3: Timeout

    it('Should resolve with {success: false, error: {message: "timeout"}} after 30000ms', function(done) {
      spyOn(airconsole, 'sendEvent_');

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('timeout');
        done();
      });

      jasmine.clock().tick(30001);
    });
  });

  // Group 4: Promise rejection cases
  // rejectMediaPermission_() is called when navigator.mediaDevices.getUserMedia itself
  // throws an unexpected error (the .catch() on the browser getUserMedia call).
  // These tests run WITHOUT the fake clock to avoid interference with Promise microtasks.
  describe('promise rejection', function() {
    beforeEach(function() {
      initAirConsoleAsController();
      spyOn(airconsole, 'sendEvent_');
    });

    it('Should reject promise with error via .catch()', function(done) {
      airconsole.getUserMedia({ audio: true })
        .then(function() {
          fail('Should not reach then handler on rejection');
        })
        .catch(function(error) {
          expect(error).toBeDefined();
          expect(error.message).toBe('Test rejection error');
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Test rejection error'));
    });

    it('Should allow promise chaining with .then().catch() on rejection', function(done) {
      airconsole.getUserMedia({ audio: true })
        .then(function() {
          fail('Should not reach success handler');
        })
        .catch(function(error) {
          expect(error.message).toContain('Stream unavailable');
          return { recovered: true };
        })
        .then(function(recoveryResult) {
          expect(recoveryResult.recovered).toBe(true);
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Stream unavailable'));
    });

    it('Should reject before timeout fires', function(done) {
      airconsole.getUserMedia({ audio: true })
        .then(function() {
          fail('Should not resolve on rejection');
        })
        .catch(function(error) {
          expect(error.message).toBe('Permission revoked');
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Permission revoked'));
    });

    it('Should not reject if already resolved', function(done) {
      let rejectionCount = 0;
      let resolutionCount = 0;

      airconsole.getUserMedia({ audio: true })
        .then(function(result) {
          resolutionCount++;
          expect(result.success).toBe(false);
          expect(result.reason).toBe('temporary');
        })
        .catch(function() {
          rejectionCount++;
          fail('Should not reject after resolution');
        })
        .then(function() {
          // rejectMediaPermission_ is now a no-op since reject_ was cleared
          airconsole.rejectMediaPermission_(new Error('Too late'));
          expect(resolutionCount).toBe(1);
          expect(rejectionCount).toBe(0);
          done();
        });

      dispatchCustomMessageEvent({
        action: 'event',
        type: 'userMediaPermissionDenied',
        data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
      });
    });

    it('Should clear timeout when promise is rejected', function(done) {
      spyOn(window, 'clearTimeout').and.callThrough();

      airconsole.getUserMedia({ audio: true })
        .catch(function() {
          expect(window.clearTimeout).toHaveBeenCalled();
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Test error'));
    });

    it('Should reset media_permission_pending_ on rejection', function(done) {
      airconsole.getUserMedia({ audio: true })
        .catch(function() {
          expect(airconsole.media_permission_pending_).toBe(false);
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Test error'));
    });

    it('Should allow a subsequent getUserMedia call after rejection', function(done) {
      airconsole.getUserMedia({ audio: true })
        .catch(function() {
          expect(airconsole.media_permission_pending_).toBe(false);

          // Second call should start a new pending request
          airconsole.getUserMedia({ video: true });
          expect(airconsole.media_permission_pending_).toBe(true);
          done();
        });

      airconsole.rejectMediaPermission_(new Error('First call rejected'));
    });

    it('Should reject and not call the then handler', function(done) {
      let thenCalled = false;

      airconsole.getUserMedia({ audio: true })
        .then(function() {
          thenCalled = true;
          fail('Then handler should not be called on rejection');
        })
        .catch(function(error) {
          expect(error).toBeDefined();
          expect(error.message).toBe('Rejection error');
          expect(thenCalled).toBe(false);
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Rejection error'));
    });

    it('Should reject when rejectMediaPermission_ is called with a browser error', function(done) {
      // rejectMediaPermission_() is the handler called by the .catch() on the browser
      // navigator.mediaDevices.getUserMedia promise chain when an unexpected error occurs.
      // Simulate that by calling it directly with a browser-style error.
      const browserError = new Error('The operation was aborted.');
      browserError.name = 'AbortError';

      airconsole.getUserMedia({ audio: true })
        .catch(function(error) {
          expect(error.name).toBe('AbortError');
          expect(error.message).toBe('The operation was aborted.');
          done();
        });

      airconsole.rejectMediaPermission_(browserError);
    });
  });

  // Group 5: promptUserMediaPermission – NotAllowedError two-event flow
  // The platform sends 'promptUserMediaPermission'; browser getUserMedia fails with NotAllowedError.
  // Implementation stores the error in resolveMediaPermissionError_, fires sendEvent_('userMediaPermissionDenied').
  // The promise only settles when the platform later echoes back 'userMediaPermissionDenied'.
  describe('promptUserMediaPermission NotAllowedError two-event flow', function() {
    beforeEach(function() {
      jasmine.clock().install();
      initAirConsoleAsController();
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    it('Should store the NotAllowedError in resolveMediaPermissionError_ and fire sendEvent_(userMediaPermissionDenied)', function(done) {
      const notAllowedError = new Error('Permission denied by user');
      notAllowedError.name = 'NotAllowedError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(notAllowedError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      // Allow the web getUserMedia rejection microtask to run
      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        expect(airconsole.resolveMediaPermissionError_).toBe(notAllowedError);
        expect(airconsole.sendEvent_).toHaveBeenCalledWith(
          'userMediaPermissionDenied',
          jasmine.objectContaining({ userPromptDuration: jasmine.any(Number) })
        );
        done();
      });
    });

    it('Should not settle the promise until the platform echoes userMediaPermissionDenied', function(done) {
      const notAllowedError = new Error('Permission denied by user');
      notAllowedError.name = 'NotAllowedError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(notAllowedError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      let resolved = false;
      airconsole.getUserMedia({ audio: true }).then(function() {
        resolved = true;
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      // After the microtask for rejection runs, promise must still be pending
      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        expect(resolved).toBe(false);
        // Now the platform sends back the denial — promise settles
        dispatchCustomMessageEvent({
          action: 'event',
          type: 'userMediaPermissionDenied',
          data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
        });
        Promise.resolve().then(function() {
          expect(resolved).toBe(true);
          done();
        });
      });
    });

    it('Should resolve with {success: false, reason, error: <NotAllowedError>} when platform echoes userMediaPermissionDenied', function(done) {
      const notAllowedError = new Error('Permission denied by user');
      notAllowedError.name = 'NotAllowedError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(notAllowedError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.reason).toBe(AirConsole.MEDIA_PERMISSION_DENIED.temporary);
        expect(result.error).toBe(notAllowedError);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        dispatchCustomMessageEvent({
          action: 'event',
          type: 'userMediaPermissionDenied',
          data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
        });
      });
    });

    it('Should clear resolveMediaPermissionError_ after the promise settles', function(done) {
      const notAllowedError = new Error('Permission denied by user');
      notAllowedError.name = 'NotAllowedError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(notAllowedError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function() {
        expect(airconsole.resolveMediaPermissionError_).toBeUndefined();
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        dispatchCustomMessageEvent({
          action: 'event',
          type: 'userMediaPermissionDenied',
          data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
        });
      });
    });
  });

  // Group 6: sendEvent_('userMediaPermissionGranted') after success
  describe('sendEvent userMediaPermissionGranted after browser success', function() {
    beforeEach(function() {
      initAirConsoleAsController();
    });

    it('Should call sendEvent_(userMediaPermissionGranted) after browser getUserMedia succeeds on userMediaPermissionGranted', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(true);
        expect(airconsole.sendEvent_).toHaveBeenCalledWith('userMediaPermissionGranted', {});
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should call sendEvent_(userMediaPermissionGranted) after browser getUserMedia succeeds on promptUserMediaPermission', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(true);
        expect(airconsole.sendEvent_).toHaveBeenCalledWith('userMediaPermissionGranted', {});
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });
    });

    it('Should NOT call sendEvent_(userMediaPermissionGranted) when browser getUserMedia rejects', function(done) {
      const testError = new Error('Permission denied');
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(testError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function() {
        const grantedCalls = airconsole.sendEvent_.calls.all().filter(function(call) {
          return call.args[0] === 'userMediaPermissionGranted';
        });
        expect(grantedCalls.length).toBe(0);
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });
  });

  // Group 7: _is_userMediaPermission_update broadcast path (GAP-04)
  describe('_is_userMediaPermission_update broadcast callbacks', function() {
    beforeEach(function() {
      initAirConsoleAsController();
    });

    it('Should call onUserMediaAccessGranted(device_id) when device state update has granted=true', function() {
      spyOn(airconsole, 'onUserMediaAccessGranted');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          _is_userMediaPermission_update: true,
          userMediaPermission: { granted: true }
        }
      });

      expect(airconsole.onUserMediaAccessGranted).toHaveBeenCalledWith(DEVICE_ID);
    });

    it('Should call onUserMediaAccessDenied(device_id, reason) when device state update has granted=false', function() {
      spyOn(airconsole, 'onUserMediaAccessDenied');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          _is_userMediaPermission_update: true,
          userMediaPermission: { granted: false, reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
        }
      });

      expect(airconsole.onUserMediaAccessDenied).toHaveBeenCalledWith(
        DEVICE_ID, AirConsole.MEDIA_PERMISSION_DENIED.temporary
      );
    });

    it('Should call onUserMediaAccessDenied with permanent reason', function() {
      spyOn(airconsole, 'onUserMediaAccessDenied');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          _is_userMediaPermission_update: true,
          userMediaPermission: { granted: false, reason: AirConsole.MEDIA_PERMISSION_DENIED.permanent }
        }
      });

      expect(airconsole.onUserMediaAccessDenied).toHaveBeenCalledWith(
        DEVICE_ID, AirConsole.MEDIA_PERMISSION_DENIED.permanent
      );
    });

    it('Should call onUserMediaAccessDenied with temporary reason', function() {
      spyOn(airconsole, 'onUserMediaAccessDenied');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          _is_userMediaPermission_update: true,
          userMediaPermission: { granted: false, reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
        }
      });

      expect(airconsole.onUserMediaAccessDenied).toHaveBeenCalledWith(
        DEVICE_ID, AirConsole.MEDIA_PERMISSION_DENIED.temporary
      );
    });

    it('Should not call onUserMediaAccessGranted or onUserMediaAccessDenied when userMediaPermission is falsy', function() {
      spyOn(airconsole, 'onUserMediaAccessGranted');
      spyOn(airconsole, 'onUserMediaAccessDenied');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          _is_userMediaPermission_update: true,
          userMediaPermission: null
        }
      });

      expect(airconsole.onUserMediaAccessGranted).not.toHaveBeenCalled();
      expect(airconsole.onUserMediaAccessDenied).not.toHaveBeenCalled();
    });

    it('Should not call onUserMediaAccessGranted or onUserMediaAccessDenied when _is_userMediaPermission_update is absent', function() {
      spyOn(airconsole, 'onUserMediaAccessGranted');
      spyOn(airconsole, 'onUserMediaAccessDenied');

      dispatchCustomMessageEvent({
        action: 'update',
        device_id: DEVICE_ID,
        device_data: {
          location: LOCATION,
          userMediaPermission: { granted: true }
        }
      });

      expect(airconsole.onUserMediaAccessGranted).not.toHaveBeenCalled();
      expect(airconsole.onUserMediaAccessDenied).not.toHaveBeenCalled();
    });
  });

  // Group 8: promptUserMediaPermission + non-NotAllowedError → timeout
  describe('promptUserMediaPermission non-NotAllowedError silently hangs', function() {
    beforeEach(function() {
      jasmine.clock().install();
      initAirConsoleAsController();
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    it('Should not settle the promise and should NOT fire sendEvent_(userMediaPermissionDenied) on non-NotAllowedError', function(done) {
      const otherError = new Error('Device not found');
      otherError.name = 'NotFoundError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(otherError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      let resolved = false;
      airconsole.getUserMedia({ audio: true }).then(function() {
        resolved = true;
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      // After microtask for browser rejection runs, check no denial event was sent and promise is still pending
      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        const denialCalls = airconsole.sendEvent_.calls.all().filter(function(call) {
          return call.args[0] === 'userMediaPermissionDenied';
        });
        expect(denialCalls.length).toBe(0);
        expect(resolved).toBe(false);
        done();
      });
    });

    it('Should eventually resolve via timeout after non-NotAllowedError on promptUserMediaPermission', function(done) {
      const otherError = new Error('Device not found');
      otherError.name = 'NotFoundError';
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.reject(otherError));
      spyOn(airconsole, 'sendEvent_').and.callThrough();

      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('timeout');
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'promptUserMediaPermission' });

      Promise.resolve().then(function() {
        return Promise.resolve();
      }).then(function() {
        jasmine.clock().tick(30001);
      });
    });
  });

  // Group 9: Constraint forwarding to browser getUserMedia
  describe('constraint forwarding to browser getUserMedia', function() {
    beforeEach(function() {
      initAirConsoleAsController();
      spyOn(airconsole, 'sendEvent_');
    });

    it('Should forward {audio: true} constraint to navigator.mediaDevices.getUserMedia', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ audio: true }).then(function() {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should forward {video: true} constraint to navigator.mediaDevices.getUserMedia', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ video: true }).then(function() {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true });
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });

    it('Should forward {audio: true, video: true} constraint to navigator.mediaDevices.getUserMedia', function(done) {
      const fakeStream = {
        getAudioTracks: function() {
          return [{}];
        }
      };
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve(fakeStream));

      airconsole.getUserMedia({ audio: true, video: true }).then(function() {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
        done();
      });

      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionGranted' });
    });
  });

  // Group 10: userMediaPermissionDenied with no data field
  describe('userMediaPermissionDenied with missing data', function() {
    beforeEach(function() {
      initAirConsoleAsController();
      spyOn(airconsole, 'sendEvent_');
    });

    it('Should resolve with {success: false, reason: undefined} when data field is absent', function(done) {
      airconsole.getUserMedia({ audio: true }).then(function(result) {
        expect(result.success).toBe(false);
        expect(result.reason).toBeUndefined();
        done();
      });

      // No 'data' field in the event message
      dispatchCustomMessageEvent({ action: 'event', type: 'userMediaPermissionDenied' });
    });
  });

  // Group 11: Post-cleanup state assertions
  describe('post-cleanup state assertions', function() {
    beforeEach(function() {
      initAirConsoleAsController();
      spyOn(airconsole, 'sendEvent_');
    });

    it('Should set media_permission_reject_ to undefined after resolveMediaPermission_', function(done) {
      airconsole.getUserMedia({ audio: true }).then(function() {
        expect(airconsole.media_permission_reject_).toBeUndefined();
        done();
      });

      dispatchCustomMessageEvent({
        action: 'event',
        type: 'userMediaPermissionDenied',
        data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
      });
    });

    it('Should set media_permission_timeout_ to undefined after resolveMediaPermission_', function(done) {
      airconsole.getUserMedia({ audio: true }).then(function() {
        expect(airconsole.media_permission_timeout_).toBeUndefined();
        done();
      });

      dispatchCustomMessageEvent({
        action: 'event',
        type: 'userMediaPermissionDenied',
        data: { reason: AirConsole.MEDIA_PERMISSION_DENIED.temporary }
      });
    });

    it('Should set media_permission_resolve_ to undefined after rejectMediaPermission_', function(done) {
      airconsole.getUserMedia({ audio: true })
        .catch(function() {
          expect(airconsole.media_permission_resolve_).toBeUndefined();
          done();
        });

      airconsole.rejectMediaPermission_(new Error('Test cleanup'));
    });
  });
}
